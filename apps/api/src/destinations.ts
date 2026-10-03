import { Controller, Get, Inject, Module, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { z } from 'zod';
import { createGraphClient, DestinationReader } from '@visitspakistan/database';
import { databaseUrl, type ServerConfig } from '@visitspakistan/config';
const READER = Symbol('DESTINATION_READER');
const localeSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
  .default('en');
@ApiTags('destinations')
@Controller(['api/v1/destinations', 'v1/destinations'])
class DestinationController {
  constructor(@Inject(READER) private readonly reader: DestinationReader) {}
  @Get()
  @ApiOperation({
    summary: 'Published canonical destinations with sourced discovery facets',
  })
  @ApiQuery({
    name: 'region',
    required: false,
    description: 'Region or province/territory ancestor slug',
  })
  @ApiQuery({ name: 'interest', required: false })
  @ApiQuery({
    name: 'season',
    required: false,
    enum: ['spring', 'summer', 'autumn', 'winter', 'all-year'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'locale', required: false })
  list(@Query() query: unknown) {
    return this.reader.directory(query);
  }
  @Get(':slug')
  @ApiOperation({
    summary:
      'Canonical destination, published editorial and eligible related entities',
  })
  @ApiQuery({ name: 'locale', required: false })
  @ApiResponse({
    status: 404,
    description: 'Destination missing, withdrawn or not publicly eligible',
  })
  get(@Param('slug') slug: string, @Query() query: unknown) {
    const q = z.object({ locale: localeSchema }).strict().parse(query);
    return this.reader.detail(
      z
        .string()
        .max(200)
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
        .parse(slug),
      q.locale,
    );
  }
}
export function destinationsModule(config: ServerConfig) {
  const db = createGraphClient(databaseUrl(config));
  @Module({
    controllers: [DestinationController],
    providers: [
      { provide: READER, useValue: new DestinationReader(db) },
      {
        provide: 'DESTINATION_CONNECTION',
        useValue: { onModuleDestroy: () => db.$disconnect() },
      },
    ],
  })
  class DestinationsModule {}
  return DestinationsModule;
}
