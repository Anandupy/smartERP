export interface RenderResult {
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
  missingVariables: string[];
}

export abstract class TemplateRenderer {
  abstract render(
    template: {
      subject?: string | null;
      bodyHtml?: string | null;
      bodyText?: string | null;
    },
    variables: Record<string, any>,
  ): RenderResult;

  abstract extractVariables(content: string): string[];
}
