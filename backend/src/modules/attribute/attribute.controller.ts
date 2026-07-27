import { Controller, Get, Param, Query } from '@nestjs/common';

import { QueryAttributeDto } from './dto/query-attribute.dto';

import { QueryAttributeValueDto } from './dto/query-attribute-value.dto';

import { AttributeService } from './services/attribute.service';

@Controller('attributes')
export class AttributeController {
  constructor(private readonly attributeService: AttributeService) {}

  @Get()
  findAttributesPublic(@Query() query: QueryAttributeDto): unknown {
    return this.attributeService.findAttributesPublic(query);
  }

  @Get('values')
  findValuesPublic(@Query() query: QueryAttributeValueDto): unknown {
    return this.attributeService.findValues({
      ...query,
      includeDeleted: false,
    });
  }

  @Get('products/:productId')
  getProductAttributes(@Param('productId') productId: string): unknown {
    return this.attributeService.getProductAttributes(productId);
  }

  @Get('variants/:variantId')
  getVariantAttributes(@Param('variantId') variantId: string): unknown {
    return this.attributeService.getVariantAttributes(variantId);
  }

  @Get(':attributeId/values')
  findValuesByAttributePublic(
    @Param('attributeId') attributeId: string,
    @Query() query: QueryAttributeValueDto,
  ): unknown {
    return this.attributeService.findValuesByAttribute(attributeId, {
      ...query,
      includeDeleted: false,
    });
  }

  @Get(':attributeId')
  findAttributePublic(@Param('attributeId') attributeId: string): unknown {
    return this.attributeService.findAttribute(attributeId, false);
  }
}
