import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Req,
  Res,
  Inject,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  Injectable,
  type CanActivate,
  type ExecutionContext,
  Module,
  Catch,
  type ExceptionFilter,
  type ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import {
  EditorialError,
  createEditorialSchema,
  editorialBodySchema,
  type CmsActor,
} from '@visitspakistan/domain';
import {
  createGraphClient,
  EditorialStore,
  StaffAuth,
  MediaStore,
  Prisma,
} from '@visitspakistan/database';
import { databaseUrl, type ServerConfig } from '@visitspakistan/config';
const AUTH = Symbol('STAFF_AUTH');
const STORE = Symbol('EDITORIAL_STORE');
const MEDIA = Symbol('MEDIA_STORE');
const KEY = Symbol('MFA_KEY');
type StaffRequest = Request & { actor: CmsActor };
const bearer = (req: Request) =>
  req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : '';
@Injectable()
class StaffGuard implements CanActivate {
  constructor(@Inject(AUTH) private readonly auth: StaffAuth) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<StaffRequest>();
    req.actor = await this.auth.authenticate(bearer(req));
    return true;
  }
}
@Catch()
export class CmsErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof EditorialError)
      return res
        .status(error.status)
        .json({ statusCode: error.status, message: error.message });
    if (error instanceof ZodError)
      return res.status(422).json({
        statusCode: 422,
        message: 'Invalid input',
        fields: [...new Set(error.issues.map((i) => i.path.join('.')))],
      });
    if (error instanceof HttpException)
      return res.status(error.getStatus()).json(error.getResponse());
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2003', 'P2025', 'P2034'].includes(error.code)
    )
      return res.status(409).json({
        statusCode: 409,
        message: 'Record conflict; reload and verify references',
      });
    return res
      .status(503)
      .json({ statusCode: 503, message: 'Service temporarily unavailable' });
  }
}
@ApiTags('staff authentication')
@Controller('api/v1/admin/auth')
class AuthController {
  private attempts = new Map<string, { count: number; expires: number }>();
  constructor(
    @Inject(AUTH) private readonly auth: StaffAuth,
    @Inject(KEY) private readonly key: string | undefined,
  ) {}
  @Post('login')
  @ApiOperation({ summary: 'Staff password and TOTP sign-in' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password', 'otp'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', format: 'password' },
        otp: { type: 'string', pattern: '^\\d{6}$' },
      },
    },
  })
  async login(@Req() req: Request, @Body() body: unknown) {
    if (!this.key)
      throw new EditorialError(503, 'Staff authentication is not configured');
    const id = req.ip ?? 'unknown';
    const current = this.attempts.get(id);
    if (current && current.expires > Date.now() && current.count >= 10)
      throw new EditorialError(429, 'Try signing in again later');
    if (this.attempts.size > 1000)
      this.attempts.delete(this.attempts.keys().next().value!);
    this.attempts.set(id, {
      count: current && current.expires > Date.now() ? current.count + 1 : 1,
      expires:
        current && current.expires > Date.now()
          ? current.expires
          : Date.now() + 60000,
    });
    const data = z
      .object({
        email: z.email().max(200),
        password: z.string().min(1).max(256),
        otp: z.string().regex(/^\d{6}$/),
      })
      .strict()
      .parse(body);
    return this.auth.login(data.email, data.password, data.otp);
  }
  @Get('me') @UseGuards(StaffGuard) @ApiBearerAuth() me(
    @Req() req: StaffRequest,
  ) {
    return req.actor;
  }
  @Post('logout') @UseGuards(StaffGuard) @ApiBearerAuth() async logout(
    @Req() req: Request,
  ) {
    await this.auth.logout(bearer(req));
    return { ok: true };
  }
}
@ApiTags('editorial administration')
@ApiBearerAuth()
@UseGuards(StaffGuard)
@Controller('api/v1/admin')
class CmsController {
  constructor(
    @Inject(STORE) private readonly store: EditorialStore,
    @Inject(MEDIA) private readonly media: MediaStore,
  ) {}
  @Get('content') list(@Req() req: StaffRequest) {
    return this.store.list(req.actor);
  }
  @Post('content')
  @ApiOperation({
    summary: 'Create an editorial draft linked to canonical UUIDs',
  })
  @ApiBody({
    schema: z.toJSONSchema(createEditorialSchema, {
      unrepresentable: 'any',
    }) as never,
  })
  create(@Req() req: StaffRequest, @Body() body: unknown) {
    return this.store.create(req.actor, body);
  }
  @Get('content/:id') get(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.store.getAdmin(req.actor, id);
  }
  @Put('content/:id')
  @ApiBody({
    schema: z.toJSONSchema(
      z.object({
        expectedVersion: z.number().int(),
        body: editorialBodySchema,
      }),
      { unrepresentable: 'any' },
    ) as never,
  })
  update(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.store.update(req.actor, id, body);
  }
  @Post('content/:id/actions')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['expectedVersion', 'action'],
      properties: {
        expectedVersion: { type: 'integer' },
        action: {
          type: 'string',
          enum: [
            'submit',
            'approve',
            'publish',
            'return',
            'new-draft',
            'withdraw',
          ],
        },
      },
    },
  })
  action(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.store.action(req.actor, id, body);
  }
  @Get('references') references(@Req() req: StaffRequest) {
    return this.store.references(req.actor);
  }
  @Post('sources') source(@Req() req: StaffRequest, @Body() body: unknown) {
    return this.store.sources(req.actor, body);
  }
  @Get('themes') themes(@Req() req: StaffRequest) {
    return this.store.themes(req.actor);
  }
  @Post('themes') theme(@Req() req: StaffRequest, @Body() body: unknown) {
    return this.store.saveTheme(req.actor, body);
  }
  @Get('templates') templates(@Req() req: StaffRequest) {
    return this.store.templates(req.actor);
  }
  @Post('templates') template(@Req() req: StaffRequest, @Body() body: unknown) {
    return this.store.saveTemplate(req.actor, body);
  }
  @Post('presentation') presentation(
    @Req() req: StaffRequest,
    @Body() body: unknown,
  ) {
    return this.store.configure(req.actor, body);
  }
  @Get('media') async assets(@Req() req: StaffRequest) {
    await this.store.actor(req.actor);
    return this.media.list();
  }
  @Post('media')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        alt: { type: 'string' },
        credit: { type: 'string' },
        rightsConfirmed: { type: 'string', enum: ['true'] },
      },
    },
  })
  async upload(
    @Req() req: StaffRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: unknown,
  ) {
    const fields = z
      .object({
        alt: z.string(),
        credit: z.string(),
        rightsConfirmed: z.literal('true'),
      })
      .strict()
      .parse(body);
    if (!file) throw new EditorialError(422, 'Choose an image');
    return this.media.upload(req.actor, file.buffer, fields.alt, fields.credit);
  }
  @Get('media/:id/content') async asset(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const { asset, bytes } = await this.media.read(id, false);
    res.type(asset.mime).setHeader('Cache-Control', 'no-store');
    res.send(bytes);
  }
}
@ApiTags('published editorial')
@Controller('api/v1')
class PublicContentController {
  constructor(
    @Inject(STORE) private readonly store: EditorialStore,
    @Inject(MEDIA) private readonly media: MediaStore,
  ) {}
  @Get('content/:slug')
  @ApiOperation({
    summary: 'Retrieve only the last published editorial snapshot',
  })
  content(@Param('slug') slug: string, @Query('locale') locale?: string) {
    if (
      !/^[a-z0-9-]{1,150}$/.test(slug) ||
      (locale && !/^[a-z]{2}(-[A-Z]{2})?$/.test(locale))
    )
      throw new EditorialError(400, 'Invalid content route');
    return this.store.getPublished(slug, locale);
  }
  @Get('presentation') presentation() {
    return this.store.presentation();
  }
  @Get('media/:id') async mediaFile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const { asset, bytes } = await this.media.read(id, true);
    res.type(asset.mime).setHeader('X-Content-Type-Options', 'nosniff');
    res.send(bytes);
  }
}
export function cmsModule(config: ServerConfig) {
  const db = createGraphClient(databaseUrl(config));
  const store = new EditorialStore(db);
  @Module({
    controllers: [AuthController, CmsController, PublicContentController],
    providers: [
      StaffGuard,
      { provide: STORE, useValue: store },
      {
        provide: AUTH,
        useValue: new StaffAuth(db, config.CMS_MFA_KEY ?? '0'.repeat(64)),
      },
      { provide: MEDIA, useValue: new MediaStore(db, config.MEDIA_ROOT) },
      { provide: KEY, useValue: config.CMS_MFA_KEY ?? null },
      {
        provide: 'CMS_CLOSE',
        useValue: { onApplicationShutdown: () => store.close() },
      },
    ],
  })
  class CmsModule {}
  return CmsModule;
}
