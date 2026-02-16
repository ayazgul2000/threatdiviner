export class CreateTemplateDto {
  name!: string;
  description?: string;
  category!: string;
  tags?: string[];
  previewImageUrl?: string;
  diagramXml!: string;
  components!: Array<{
    name: string;
    type: string;
    technology?: string;
    description?: string;
    criticality?: string;
    dataClassification?: string;
    positionX?: number;
    positionY?: number;
  }>;
  dataFlows?: Array<{
    sourceName: string;
    targetName: string;
    label?: string;
    protocol?: string;
    dataType?: string;
    authentication?: boolean;
    encryption?: boolean;
  }>;
  boundaries?: Array<{
    name: string;
    type: string;
    description?: string;
    componentNames: string[];
  }>;
  isPublic?: boolean;
  tenantId?: string;
}

export class UpdateTemplateDto {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  previewImageUrl?: string;
  diagramXml?: string;
  components?: Array<{
    name: string;
    type: string;
    technology?: string;
    description?: string;
    criticality?: string;
    dataClassification?: string;
    positionX?: number;
    positionY?: number;
  }>;
  dataFlows?: Array<{
    sourceName: string;
    targetName: string;
    label?: string;
    protocol?: string;
    dataType?: string;
    authentication?: boolean;
    encryption?: boolean;
  }>;
  boundaries?: Array<{
    name: string;
    type: string;
    description?: string;
    componentNames: string[];
  }>;
  isPublic?: boolean;
}

export class TemplateListQuery {
  search?: string;
  category?: string;
  isPublic?: string;
  tenantId?: string;
  limit?: string;
  offset?: string;
}
