import * as blessed from 'blessed';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EvalResult, ConditionalResult } from '../types';

export class InteractiveUI {
  private screen: blessed.Widgets.Screen;
  private resultsBox: blessed.Widgets.BoxElement;
  private commandInput: blessed.Widgets.TextboxElement;
  private summaryBox: blessed.Widgets.BoxElement;
  private commandPromptLabel: blessed.Widgets.TextElement;
  private resultsContent: string[] = [];
  private onCommand: ((cmd: string) => Promise<void>) | null = null;
  private onboardingHandler: ((input: string) => void) | null = null;
  private isOnboarding: boolean = false;
  private currentFilePath: string | null = null;
  private lastResults: EvalResult[] | null = null;
  private lastTotalTime: number | null = null;
  private runLog: string[] = [];
  private currentRunId: string | null = null;
  private yamlContent: string | null = null;
  private outputDir: string;

  constructor(outputDir?: string) {
    // Set up output directory
    this.outputDir = outputDir || path.join(os.homedir(), '.vibecheck', 'runs');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'VibeCheck CLI',
      fullUnicode: true,
    });

    // Top area - File display (largest area)
    this.resultsBox = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: '70%-1',
      content: '{bold}{cyan-fg}✨ VibeCheck - Ready to check those vibes{/cyan-fg}{/bold}\n\nLoad a file to get started',
      tags: true,
      border: {
        type: 'line',
      },
      label: ' Results ',
      style: {
        fg: 'white',
        border: {
          fg: 'cyan',
        },
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'grey',
        },
        style: {
          inverse: true,
        },
      },
    });

    // Middle area - Results summary (with yellow outline)
    this.summaryBox = blessed.box({
      top: '70%',
      left: 0,
      width: '100%',
      height: '30%-2',
      content: '',
      tags: true,
      border: {
        type: 'line',
      },
      label: ' Results ',
      style: {
        fg: 'white',
        border: {
          fg: 'yellow',
        },
        focus: {
          border: {
            fg: 'green',
          },
        },
      },
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      mouse: true,
      vi: true,
      scrollbar: {
        ch: '█',
        track: {
          bg: 'grey',
        },
        style: {
          inverse: true,
        },
      },
    });

    // Command prompt label at bottom
    this.commandPromptLabel = blessed.text({
      top: '98%',
      left: 0,
      width: 2,
      height: 1,
      content: ':',
      style: {
        fg: 'yellow',
        bold: true,
      },
    });

    // Bottom area - Command input (no outline)
    this.commandInput = blessed.textbox({
      top: '98%',
      left: 2,
      width: '100%-2',
      height: 1,
      inputOnFocus: true,
      keys: true,
      mouse: true,
      vi: false,
      style: {
        fg: 'white',
        bg: 'black',
      },
    });

    // Append boxes to screen
    this.screen.append(this.resultsBox);
    this.screen.append(this.summaryBox);
    this.screen.append(this.commandPromptLabel);
    this.screen.append(this.commandInput);

    // Set up command input handler
    this.commandInput.on('submit', async (value: string) => {
      const command = value.trim();

      // If in onboarding mode, use onboarding handler
      if (this.isOnboarding && this.onboardingHandler) {
        this.onboardingHandler(command);
        this.commandInput.clearValue();
        this.commandInput.focus();
        this.screen.render();
        return;
      }

      // Otherwise use normal command handler
      if (command && this.onCommand) {
        await this.onCommand(command);
      }
      this.commandInput.clearValue();
      this.commandInput.focus();
      this.screen.render();
    });

    // Handle Ctrl+C to exit
    this.screen.key(['C-c'], () => {
      this.printSummaryToConsole();
      this.destroy();
      process.exit(0);
    });

    // Tab to toggle focus between results and command input
    this.screen.key(['tab'], () => {
      if (this.screen.focused === this.summaryBox) {
        this.commandInput.focus();
      } else {
        this.summaryBox.focus();
      }
      this.screen.render();
    });

    // Escape always goes back to command input
    this.screen.key(['escape'], () => {
      this.commandInput.focus();
      this.screen.render();
    });

    // Scroll keys - only work when results box is focused
    this.summaryBox.key(['up', 'k'], () => {
      this.summaryBox.scroll(-1);
      this.screen.render();
    });

    this.summaryBox.key(['down', 'j'], () => {
      this.summaryBox.scroll(1);
      this.screen.render();
    });

    this.summaryBox.key(['pageup'], () => {
      this.summaryBox.scroll(-10);
      this.screen.render();
    });

    this.summaryBox.key(['pagedown'], () => {
      this.summaryBox.scroll(10);
      this.screen.render();
    });

    // Start with focus on command input
    this.commandInput.focus();
  }

  setCommandHandler(handler: (cmd: string) => Promise<void>) {
    this.onCommand = handler;
  }

  setOnboardingHandler(handler: (input: string) => void) {
    this.onboardingHandler = handler;
    this.isOnboarding = true;
  }

  exitOnboarding() {
    this.isOnboarding = false;
    this.onboardingHandler = null;
  }

  appendResults(text: string) {
    this.resultsContent.push(text);
    this.resultsBox.setContent(this.resultsContent.join('\n'));
    this.resultsBox.setScrollPerc(100); // Auto-scroll to bottom
    this.screen.render();

    // Add to run log (strip blessed tags for plain text)
    const plainText = text.replace(/\{[^}]+\}/g, '');
    this.runLog.push(plainText);
  }

  setRunId(runId: string) {
    this.currentRunId = runId;
    this.runLog.push(`\n=== Run ID: ${runId} ===`);
    this.runLog.push(`Timestamp: ${new Date().toISOString()}\n`);
  }

  setYamlContent(yaml: string) {
    this.yamlContent = yaml;
  }

  clearResults() {
    this.resultsContent = [];
    this.resultsBox.setContent('');
    this.screen.render();
  }

  displayEvalHeader(suiteName: string, model: string, systemPrompt: string, isUpdate: boolean) {
    this.clearResults();
    if (isUpdate) {
      this.appendResults('{yellow-fg}Updating eval suite: ' + suiteName + '{/yellow-fg}');
    } else {
      this.appendResults('{green-fg}Saving new eval suite: ' + suiteName + '{/green-fg}');
    }
    this.appendResults('');
    this.appendResults('{bold}{cyan-fg}✨ Checking vibes for: ' + suiteName + '{/cyan-fg}{/bold}');
    this.appendResults('{bold}{cyan-fg}Model: ' + model + '{/cyan-fg}{/bold}');
    this.appendResults('{bold}{cyan-fg}System prompt: ' + systemPrompt + '{/cyan-fg}{/bold}');
    this.appendResults('');
  }

  displayResult(result: EvalResult) {
    this.appendResults('{bold}' + result.evalName + ':{/bold}');
    this.appendResults('{blue-fg}Prompt: ' + this.escapeText(result.prompt) + '{/blue-fg}');
    this.appendResults('{gray-fg}Response: ' + this.escapeText(result.response) + '{/gray-fg}');

    result.conditionalResults.forEach((cond: ConditionalResult) => {
      const status = cond.passed ? '{green-fg}✅ PASS{/green-fg}' : '{red-fg}🚩 FAIL{/red-fg}';
      const details = this.formatConditionalDetails(cond, result.response);

      if (cond.type === 'llm_judge') {
        this.appendResults('  ' + status + ' ' + cond.type.padEnd(25));
        if (typeof details === 'string') {
          this.appendResults('      {gray-fg}' + this.escapeText(details) + '{/gray-fg}');
        }
      } else if (cond.type === 'string_contains') {
        if (typeof details === 'object' && 'text' in details) {
          const { text } = details;
          this.appendResults('  ' + status + ' ' + cond.type.padEnd(25) + ' {gray-fg}' + this.escapeText(text) + '{/gray-fg}');
        } else {
          this.appendResults('  ' + status + ' ' + cond.type.padEnd(25) + ' {gray-fg}' + this.escapeText(details as string) + '{/gray-fg}');
        }
      } else if (cond.type === 'semantic_similarity') {
        const coloredDetails = cond.passed ? '{green-fg}' + this.escapeText(details as string) + '{/green-fg}' : '{red-fg}' + this.escapeText(details as string) + '{/red-fg}';
        this.appendResults('  ' + status + ' ' + cond.type.padEnd(25) + ' ' + coloredDetails);
      } else {
        const coloredDetails = cond.passed ? '{green-fg}' + this.escapeText(details as string) + '{/green-fg}' : '{red-fg}' + this.escapeText(details as string) + '{/red-fg}';
        this.appendResults('  ' + status + ' ' + cond.type.padEnd(25) + ' ' + coloredDetails);
      }
    });

    const overallStatus = result.passed ? '{green-fg}✅ PASS{/green-fg}' : '{red-fg}🚩 FAIL{/red-fg}';
    this.appendResults('  Overall: ' + overallStatus);
    this.appendResults('');
  }

  displaySummary(results: EvalResult[], totalTimeMs?: number) {
    // Store results for later use when exiting
    this.lastResults = results;
    this.lastTotalTime = totalTimeMs || null;

    // Write run output to file
    this.writeRunOutput(results, totalTimeMs);

    const lines: string[] = [];

    lines.push('{bold}' + '─'.repeat(80) + '{/bold}');
    lines.push('{bold}✨ VIBE CHECK SUMMARY ✨{/bold}');
    lines.push('{bold}' + '─'.repeat(80) + '{/bold}');
    lines.push('');

    // Find the longest eval name for padding
    const maxNameLength = Math.max(...results.map(r => r.evalName.length), 20);

    // Display each eval with visual bar chart
    results.forEach((result) => {
      const paddedName = result.evalName.padEnd(maxNameLength);

      // Calculate pass/fail counts for conditionals
      const passedConditionals = result.conditionalResults.filter(c => c.passed).length;
      const failedConditionals = result.conditionalResults.filter(c => !c.passed).length;

      // Create visual bar
      const failBar = '-'.repeat(failedConditionals);
      const passBar = '+'.repeat(passedConditionals);

      // Format time
      const timeStr = result.executionTimeMs
        ? `in ${(result.executionTimeMs / 1000).toFixed(1)}s`
        : '';

      const coloredFailBar = '{red-fg}' + failBar + '{/red-fg}';
      const coloredPassBar = '{green-fg}' + passBar + '{/green-fg}';
      const status = result.passed ? '{green-fg}✅{/green-fg}' : '{red-fg}🚩{/red-fg}';

      lines.push(paddedName + '  ' + coloredFailBar + '|' + coloredPassBar + '  ' + status + ' ' + timeStr);
    });

    // Calculate pass rate
    const totalEvals = results.length;
    const passedEvals = results.filter(r => r.passed).length;
    const passRate = totalEvals > 0 ? (passedEvals / totalEvals) * 100 : 0;

    lines.push('');
    lines.push('{bold}' + '─'.repeat(80) + '{/bold}');

    let vibeStatus = '🚩 bad vibes';
    let color = 'red-fg';
    if (passRate === 100) {
      color = 'green-fg';
      vibeStatus = '✨ good vibes';
    } else if (passRate >= 80) {
      color = 'yellow-fg';
      vibeStatus = '😬 sketchy vibes';
    }

    lines.push('{' + color + '}Vibe Rating: ' + passedEvals + '/' + totalEvals + ' (' + passRate.toFixed(1) + '%) - ' + vibeStatus + '{/' + color + '}');
    if (totalTimeMs) {
      lines.push('{cyan-fg}Total Time: ' + (totalTimeMs / 1000).toFixed(2) + 's{/cyan-fg}');
    }
    lines.push('{bold}' + '─'.repeat(80) + '{/bold}');
    lines.push('');

    if (passRate < 80) {
      lines.push('{red-fg}🚩 Bad vibes detected: Vibe rating below 80%{/red-fg}');
    } else {
      lines.push('{green-fg}✨ Good vibes all around!{/green-fg}');
    }

    this.summaryBox.setContent(lines.join('\n'));
    this.summaryBox.setScrollPerc(100); // Auto-scroll to bottom

    // Auto-focus the results box so user can scroll immediately
    this.summaryBox.focus();
    this.screen.render();
  }

  printSummaryToConsole() {
    if (!this.lastResults) {
      return;
    }

    const chalk = require('chalk');
    const results = this.lastResults;
    const totalTimeMs = this.lastTotalTime;

    console.log();
    console.log(chalk.bold('─'.repeat(80)));
    console.log(chalk.bold('✨ VIBE CHECK SUMMARY ✨'));
    console.log(chalk.bold('─'.repeat(80)));
    console.log();

    // Find the longest eval name for padding
    const maxNameLength = Math.max(...results.map(r => r.evalName.length), 20);

    // Display each eval with visual bar chart
    results.forEach((result) => {
      const paddedName = result.evalName.padEnd(maxNameLength);

      // Calculate pass/fail counts for conditionals
      const passedConditionals = result.conditionalResults.filter(c => c.passed).length;
      const failedConditionals = result.conditionalResults.filter(c => !c.passed).length;

      // Create visual bar
      const failBar = '-'.repeat(failedConditionals);
      const passBar = '+'.repeat(passedConditionals);

      // Format time
      const timeStr = result.executionTimeMs
        ? `in ${(result.executionTimeMs / 1000).toFixed(1)}s`
        : '';

      const coloredFailBar = chalk.red(failBar);
      const coloredPassBar = chalk.green(passBar);
      const status = result.passed ? chalk.green('✅') : chalk.red('🚩');

      console.log(`${paddedName}  ${coloredFailBar}|${coloredPassBar}  ${status} ${timeStr}`);
    });

    // Calculate pass rate
    const totalEvals = results.length;
    const passedEvals = results.filter(r => r.passed).length;
    const passRate = totalEvals > 0 ? (passedEvals / totalEvals) * 100 : 0;

    console.log();
    console.log(chalk.bold('─'.repeat(80)));

    let passRateColor = chalk.red;
    let vibeStatus = '🚩 bad vibes';
    if (passRate === 100) {
      passRateColor = chalk.green;
      vibeStatus = '✨ good vibes';
    } else if (passRate >= 80) {
      passRateColor = chalk.yellow;
      vibeStatus = '😬 sketchy vibes';
    }

    console.log(passRateColor(`Vibe Rating: ${passedEvals}/${totalEvals} (${passRate.toFixed(1)}%) - ${vibeStatus}`));
    if (totalTimeMs) {
      console.log(chalk.cyan(`Total Time: ${(totalTimeMs / 1000).toFixed(2)}s`));
    }
    console.log(chalk.bold('─'.repeat(80)));
    console.log();

    if (passRate < 80) {
      console.log(chalk.red('🚩 Bad vibes detected: Vibe rating below 80%\n'));
    } else {
      console.log(chalk.green('✨ Good vibes all around!\n'));
    }
  }

  displayError(message: string) {
    this.appendResults('{red-fg}🚩 Error: ' + this.escapeText(message) + '{/red-fg}');
  }

  displayInfo(message: string) {
    this.summaryBox.setContent(message);
    this.summaryBox.setScrollPerc(100); // Auto-scroll to bottom
    this.screen.render();
  }

  private escapeText(text: string): string {
    // Escape blessed tags to prevent them from being interpreted
    return text.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
  }

  private formatConditionalDetails(cond: ConditionalResult, response: string): string | { text: string; highlight: string } {
    const message = cond.message || '';

    if (cond.type === 'string_contains') {
      const match = message.match(/contains? ['"](.+?)['"]/i) || message.match(/found ['"](.+?)['"]/i);
      if (match) {
        const searchString = match[1];
        const index = response.toLowerCase().indexOf(searchString.toLowerCase());
        if (index !== -1) {
          const start = Math.max(0, index - 10);
          const end = Math.min(response.length, index + searchString.length + 10);
          const snippet = response.substring(start, end);
          const highlightText = response.substring(index, index + searchString.length);
          return { text: this.truncateText(snippet, 50), highlight: highlightText };
        }
        return this.truncateText(searchString, 50);
      }
      return this.truncateText(message, 60);
    }

    if (cond.type === 'semantic_similarity') {
      const simMatch = message.match(/similarity[:\s]+(\d+(?:\.\d+)?)/i);
      if (simMatch) {
        const similarity = parseFloat(simMatch[1]);
        const simPercent = similarity <= 1 ? (similarity * 100).toFixed(0) : similarity.toFixed(0);
        return `${simPercent}%`;
      }
      return this.truncateText(message, 60);
    }

    if (cond.type === 'llm_judge') {
      return cond.passed ? 'PASS' : this.truncateText(message, 80);
    }

    if (cond.type === 'token_length') {
      const countMatch = message.match(/(\d+)\s+tokens?/i);
      const minMatch = message.match(/min[:\s]+(\d+)/i);
      const maxMatch = message.match(/max[:\s]+(\d+)/i);

      if (countMatch) {
        const count = countMatch[1];
        const min = minMatch ? minMatch[1] : null;
        const max = maxMatch ? maxMatch[1] : null;

        if (min && max) {
          return `Token count ${count} (min: ${min}, max: ${max})`;
        } else if (min) {
          return `Token count ${count} (min: ${min})`;
        } else if (max) {
          return `Token count ${count} (max: ${max})`;
        }
        return `Token count ${count}`;
      }
      return this.truncateText(message, 60);
    }

    return this.truncateText(message, 60);
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  displayFileContent(filePath: string, content: string) {
    this.currentFilePath = filePath;
    this.resultsBox.setLabel(' ' + filePath + ' ');
    this.clearResults();
    this.appendResults('{bold}{cyan-fg}📄 Loaded file: ' + filePath + '{/cyan-fg}{/bold}');
    this.appendResults('');
    this.appendResults('{gray-fg}' + this.escapeText(content) + '{/gray-fg}');

    // Display command help in Results tab
    this.displayCommandHelp();
  }

  displayCommandHelp() {
    const helpText = [
      '',
      '{bold}{yellow-fg}Available Commands:{/yellow-fg}{/bold}',
      '',
      '{cyan-fg}:check{/cyan-fg}              - Run the loaded evaluation file',
      '{cyan-fg}:exit, :quit, :q{/cyan-fg} - Exit the interactive mode',
      '',
      '{bold}{yellow-fg}Navigation:{/yellow-fg}{/bold}',
      '',
      '{cyan-fg}Tab{/cyan-fg}              - Toggle focus between Results and command input',
      '{cyan-fg}↑/↓ or j/k{/cyan-fg}      - Scroll Results pane (when focused)',
      '{cyan-fg}Page Up/Down{/cyan-fg}    - Fast scroll in Results pane (when focused)',
      '{cyan-fg}Escape{/cyan-fg}           - Return to command input',
      '{cyan-fg}Ctrl+C{/cyan-fg}           - Exit and show summary in terminal',
      '',
      '{bold}{yellow-fg}Output:{/yellow-fg}{/bold}',
      '',
      `{gray-fg}Run outputs saved to: ${this.outputDir}{/gray-fg}`,
      ''
    ];

    this.summaryBox.setContent(helpText.join('\n'));
    this.summaryBox.setScrollPerc(100); // Auto-scroll to bottom
    this.screen.render();
  }

  setFilePathLabel(filePath: string) {
    this.currentFilePath = filePath;
    this.resultsBox.setLabel(' ' + filePath + ' ');
    this.screen.render();
  }

  writeRunOutput(results: EvalResult[], totalTimeMs?: number) {
    if (!this.currentRunId) {
      return;
    }

    const outputPath = path.join(this.outputDir, `${this.currentRunId}.txt`);
    const output: string[] = [];

    // Header
    output.push('='.repeat(80));
    output.push('VIBECHECK RUN OUTPUT');
    output.push('='.repeat(80));
    output.push('');
    output.push(`Run ID: ${this.currentRunId}`);
    output.push(`Timestamp: ${new Date().toISOString()}`);
    output.push('');

    // YAML content
    if (this.yamlContent) {
      output.push('='.repeat(80));
      output.push('EVALUATION YAML');
      output.push('='.repeat(80));
      output.push('');
      output.push(this.yamlContent);
      output.push('');
    }

    // Streamed logs
    output.push('='.repeat(80));
    output.push('EXECUTION LOG');
    output.push('='.repeat(80));
    output.push('');
    output.push(...this.runLog);
    output.push('');

    // Summary
    output.push('='.repeat(80));
    output.push('SUMMARY');
    output.push('='.repeat(80));
    output.push('');

    const maxNameLength = Math.max(...results.map(r => r.evalName.length), 20);

    results.forEach((result) => {
      const paddedName = result.evalName.padEnd(maxNameLength);
      const passedConditionals = result.conditionalResults.filter(c => c.passed).length;
      const failedConditionals = result.conditionalResults.filter(c => !c.passed).length;
      const failBar = '-'.repeat(failedConditionals);
      const passBar = '+'.repeat(passedConditionals);
      const timeStr = result.executionTimeMs ? `in ${(result.executionTimeMs / 1000).toFixed(1)}s` : '';
      const status = result.passed ? '✅' : '🚩';

      output.push(`${paddedName}  ${failBar}|${passBar}  ${status} ${timeStr}`);
    });

    const totalEvals = results.length;
    const passedEvals = results.filter(r => r.passed).length;
    const passRate = totalEvals > 0 ? (passedEvals / totalEvals) * 100 : 0;

    output.push('');
    output.push('-'.repeat(80));

    let vibeStatus = '🚩 bad vibes';
    if (passRate === 100) {
      vibeStatus = '✨ good vibes';
    } else if (passRate >= 80) {
      vibeStatus = '😬 sketchy vibes';
    }

    output.push(`Vibe Rating: ${passedEvals}/${totalEvals} (${passRate.toFixed(1)}%) - ${vibeStatus}`);
    if (totalTimeMs) {
      output.push(`Total Time: ${(totalTimeMs / 1000).toFixed(2)}s`);
    }
    output.push('-'.repeat(80));
    output.push('');

    if (passRate < 80) {
      output.push('🚩 Bad vibes detected: Vibe rating below 80%');
    } else {
      output.push('✨ Good vibes all around!');
    }

    output.push('');
    output.push(`Output saved to: ${outputPath}`);
    output.push('');

    // Write to file
    try {
      fs.writeFileSync(outputPath, output.join('\n'));
      this.displayInfo(`Output saved to: ${outputPath}`);
    } catch (error: any) {
      this.displayError(`Failed to write output file: ${error.message}`);
    }
  }

  render() {
    this.screen.render();
  }

  destroy() {
    this.screen.destroy();
  }
}
