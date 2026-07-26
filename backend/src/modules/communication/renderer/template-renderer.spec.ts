import { HandlebarsTemplateRenderer } from './handlebars-template.renderer';

describe('HandlebarsTemplateRenderer', () => {
  let renderer: HandlebarsTemplateRenderer;

  beforeEach(() => {
    renderer = new HandlebarsTemplateRenderer();
  });

  it('should render variables inside template strings correctly', () => {
    const template = {
      subject: 'Welcome {{userName}} to {{organizationName}}',
      bodyHtml: '<p>Hello {{userName}}, your code is {{otp}}</p>',
      bodyText: 'Hello {{userName}}, your code is {{otp}}',
    };

    const variables = {
      userName: 'Alice',
      organizationName: 'Horizon School',
      otp: '654321',
    };

    const result = renderer.render(template, variables);

    expect(result.subject).toBe('Welcome Alice to Horizon School');
    expect(result.bodyHtml).toBe('<p>Hello Alice, your code is 654321</p>');
    expect(result.bodyText).toBe('Hello Alice, your code is 654321');
    expect(result.missingVariables).toEqual([]);
  });

  it('should detect missing variables during render', () => {
    const template = {
      subject: 'Reset Password for {{userName}}',
      bodyHtml: '<p>Click link: {{resetLink}} expires in {{minutes}} mins</p>',
    };

    const variables = {
      userName: 'Bob',
    };

    const result = renderer.render(template, variables);

    expect(result.subject).toBe('Reset Password for Bob');
    expect(result.bodyHtml).toBe('<p>Click link: {{resetLink}} expires in {{minutes}} mins</p>');
    expect(result.missingVariables).toContain('resetLink');
    expect(result.missingVariables).toContain('minutes');
  });

  it('should extract variables from a template string', () => {
    const content = 'Hi {{studentName}}, your fee receipt #{{receiptNo}} for amount {{amount}} is ready.';
    const vars = renderer.extractVariables(content);

    expect(vars).toEqual(['studentName', 'receiptNo', 'amount']);
  });
});
