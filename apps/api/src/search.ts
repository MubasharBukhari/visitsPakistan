import { Controller, Header, Get, Inject, Module, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import {
  createGraphClient,
  SearchProjectionReader,
} from '@visitspakistan/database';
import { OpenSearchClient, UnifiedSearch } from '@visitspakistan/search';
import { databaseUrl, type ServerConfig } from '@visitspakistan/config';
const SEARCH = Symbol('UNIFIED_SEARCH');
@ApiTags('search')
@Controller('api/v1/search')
class SearchController {
  constructor(@Inject(SEARCH) private readonly service: UnifiedSearch) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Grouped public canonical discovery search, typo-tolerant and independent of commercial signals',
  })
  @ApiQuery({ name: 'q', required: true, description: '1–120 characters' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['DESTINATION', 'PLACE', 'EXPERIENCE'],
  })
  @ApiQuery({
    name: 'destination',
    required: false,
    description: 'Canonical destination slug',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: '1–100; page applies independently to each group',
  })
  @ApiQuery({
    name: 'locale',
    required: false,
    description: 'Entity locale, default en; alternate names may be Urdu',
  })
  @ApiQuery({ name: 'autocomplete', required: false, type: Boolean })
  @ApiQuery({ name: 'lat', required: false, type: Number })
  @ApiQuery({ name: 'lon', required: false, type: Number })
  @ApiResponse({
    status: 503,
    description: 'Search or canonical storage temporarily unavailable',
  })
  query(@Query() input: unknown) {
    return this.service.query(input);
  }
}
export function searchModule(config: ServerConfig) {
  const db = createGraphClient(databaseUrl(config));
  @Module({
    controllers: [SearchController],
    providers: [
      {
        provide: SEARCH,
        useValue: new UnifiedSearch(
          new SearchProjectionReader(db),
          new OpenSearchClient(
            config.OPENSEARCH_URL,
            config.SEARCH_INDEX_PREFIX,
          ),
        ),
      },
      {
        provide: 'SEARCH_DB',
        useValue: { onModuleDestroy: () => db.$disconnect() },
      },
    ],
  })
  class SearchModule {}
  return SearchModule;
}
