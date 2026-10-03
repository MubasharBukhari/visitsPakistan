import { Controller, Get, Inject, Module, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { z } from 'zod';
import { createGraphClient, DiscoveryReader } from '@visitspakistan/database';
import { databaseUrl, type ServerConfig } from '@visitspakistan/config';
const READER = Symbol('DISCOVERY_READER');
const detailQuery = z
  .object({
    locale: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
      .default('en'),
  })
  .strict();
const slugSchema = z
  .string()
  .max(200)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
@ApiTags('discovery')
@Controller('api/v1')
class DiscoveryController {
  constructor(@Inject(READER) private readonly reader: DiscoveryReader) {}
  @Get('places/:slug')
  @ApiOperation({
    summary:
      'Published canonical attraction, editorial, experiences and asserted nearby places',
  })
  @ApiQuery({ name: 'locale', required: false })
  @ApiResponse({
    status: 404,
    description: 'Place missing or not publicly eligible',
  })
  place(@Param('slug') slug: string, @Query() input: unknown) {
    return this.reader.detail(
      'PLACE',
      slugSchema.parse(slug),
      detailQuery.parse(input).locale,
    );
  }
  @Get('experiences/:slug')
  @ApiOperation({
    summary:
      'Published independent experience concept and canonical connected places/destinations',
  })
  @ApiQuery({ name: 'locale', required: false })
  @ApiResponse({
    status: 404,
    description: 'Experience missing or not publicly eligible',
  })
  experience(@Param('slug') slug: string, @Query() input: unknown) {
    return this.reader.detail(
      'EXPERIENCE',
      slugSchema.parse(slug),
      detailQuery.parse(input).locale,
    );
  }
  @Get('things-to-do')
  @ApiOperation({
    summary:
      'Published attraction and experience discovery with AND filters and bounded pagination',
  })
  @ApiQuery({
    name: 'destination',
    required: false,
    description: 'Eligible destination slug connected by approved graph edges',
  })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({
    name: 'season',
    required: false,
    enum: ['spring', 'summer', 'autumn', 'winter', 'all-year'],
  })
  @ApiQuery({
    name: 'familySuitable',
    required: false,
    type: Boolean,
    description: 'Unknown suitability is excluded',
  })
  @ApiQuery({
    name: 'duration',
    required: false,
    type: Number,
    description:
      'Maximum recommended/concept minutes, 1–10080; unknown duration excluded',
  })
  @ApiQuery({ name: 'kind', required: false, enum: ['place', 'experience'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'locale', required: false })
  things(@Query() input: unknown) {
    return this.reader.directory(input);
  }
}
export function discoveryModule(config: ServerConfig) {
  const db = createGraphClient(databaseUrl(config));
  @Module({
    controllers: [DiscoveryController],
    providers: [
      { provide: READER, useValue: new DiscoveryReader(db) },
      {
        provide: 'DISCOVERY_CONNECTION',
        useValue: { onModuleDestroy: () => db.$disconnect() },
      },
    ],
  })
  class DiscoveryModule {}
  return DiscoveryModule;
}
