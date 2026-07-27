export enum AttributeEventType {
  ATTRIBUTE_CREATED = 'attribute.created',
  ATTRIBUTE_UPDATED = 'attribute.updated',
  ATTRIBUTE_DELETED = 'attribute.deleted',
  ATTRIBUTE_RESTORED = 'attribute.restored',

  VALUE_CREATED = 'attribute.value_created',
  VALUE_UPDATED = 'attribute.value_updated',
  VALUE_DELETED = 'attribute.value_deleted',
  VALUE_RESTORED = 'attribute.value_restored',

  PRODUCT_ATTRIBUTES_SYNCED = 'attribute.product_attributes_synced',
  VARIANT_ATTRIBUTES_SYNCED = 'attribute.variant_attributes_synced',
}
