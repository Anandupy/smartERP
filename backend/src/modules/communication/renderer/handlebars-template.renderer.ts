import { Injectable } from '@nestjs/common';
import { RenderResult, TemplateRenderer } from './template-renderer.interface';

@Injectable()
export class HandlebarsTemplateRenderer implements TemplateRenderer {
  render(
    template: {
      subject?: string | null;
      bodyHtml?: string | null;
      bodyText?: string | null;
    },
    variables: Record<string, any>,
  ): RenderResult {
    const missingVarsSet = new Set<string>();

    const renderText = (source?: string | null): string => {
      if (!source) return '';
      return source.replace(
        /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,
        (_, varName) => {
          const val = this.resolvePath(variables, varName);
          if (val === undefined || val === null) {
            missingVarsSet.add(varName);
            return `{{${varName}}}`;
          }
          return String(val);
        },
      );
    };

    const renderedSubject = template.subject
      ? renderText(template.subject)
      : undefined;
    const renderedBodyHtml = template.bodyHtml
      ? renderText(template.bodyHtml)
      : undefined;
    const renderedBodyText = template.bodyText
      ? renderText(template.bodyText)
      : undefined;

    return {
      subject: renderedSubject,
      bodyHtml: renderedBodyHtml,
      bodyText: renderedBodyText,
      missingVariables: Array.from(missingVarsSet),
    };
  }

  extractVariables(content: string): string[] {
    if (!content) return [];
    const matches = content.match(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g);
    if (!matches) return [];

    const vars = new Set<string>();
    for (const match of matches) {
      const varName = match.replace(/[{}\s]/g, '');
      if (varName) vars.add(varName);
    }
    return Array.from(vars);
  }

  private resolvePath(obj: Record<string, any>, path: string): any {
    return path
      .split('.')
      .reduce(
        (acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined),
        obj,
      );
  }
}
