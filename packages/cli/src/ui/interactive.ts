import * as blessed from 'blessed';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EvalResult, ConditionalResult } from '../types';
import { writeRunOutput as writeRunOutputToFile } from '../utils/output-writer';

// Configurable table width - easy to tweak
const TABLE_WIDTH = 120;

// Cache for stringWidth function to avoid repeated dynamic imports
let stringWidthCache: any = null;

async function getStringWidth() {
  if (!stringWidthCache) {
    try {
      // Use eval to avoid TypeScript compilation issues with dynamic imports
      const stringWidthModule = await eval('import("string-width")');
      stringWidthCache = stringWidthModule.default;
    } catch (error) {
      // Fallback to a simple character width calculation if string-width fails
      console.warn('Warning: string-width module not available, using fallback character width calculation');
      stringWidthCache = (str: string) => str.length; // Simple fallback
    }
  }
  return stringWidthCache;
}

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
  private isUserScrolling: boolean = false;

  constructor(outputDir?: string) {
    // Set up output directory (priority: parameter > env var > default)
    this.outputDir = outputDir || process.env.VIBECHECK_OUTPUT_DIR || path.join(os.homedir(), '.vibecheck', 'runs');

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
      width: '100%-2',
      height: '70%-1',
      content: '{bold}{cyan-fg}✨ VibeCheck - Ready to check those vibes{/cyan-fg}{/bold}\n\nLoad a file to get started',
      tags: true,
      wrap: false,
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
      width: '100%-2',
      height: '30%-2',
      content: '',
      tags: true,
      wrap: false,
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
    this.screen.key(['C-c'], async () => {
      await this.printSummaryToConsole();
      this.destroy();
      process.exit(0);
    });

    // Tab to cycle focus between results, summary, and command input
    this.screen.key(['tab'], () => {
      if (this.screen.focused === this.resultsBox) {
        this.summaryBox.focus();
      } else if (this.screen.focused === this.summaryBox) {
        this.commandInput.focus();
      } else {
        this.resultsBox.focus();
      }
      this.screen.render();
    });

    // Escape always goes back to command input
    this.screen.key(['escape'], () => {
      this.commandInput.focus();
      this.screen.render();
    });

    // Scroll keys for resultsBox
    this.resultsBox.key(['up', 'k'], () => {
      this.isUserScrolling = true;
      this.resultsBox.scroll(-1);
      this.screen.render();
    });

    this.resultsBox.key(['down', 'j'], () => {
      this.isUserScrolling = true;
      this.resultsBox.scroll(1);
      this.screen.render();
    });

    this.resultsBox.key(['pageup'], () => {
      this.isUserScrolling = true;
      this.resultsBox.scroll(-10);
      this.screen.render();
    });

    this.resultsBox.key(['pagedown'], () => {
      this.isUserScrolling = true;
      this.resultsBox.scroll(10);
      this.screen.render();
    });

    // Scroll keys for summaryBox
    this.summaryBox.key(['up', 'k'], () => {
      this.isUserScrolling = true;
      this.summaryBox.scroll(-1);
      this.screen.render();
    });

    this.summaryBox.key(['down', 'j'], () => {
      this.isUserScrolling = true;
      this.summaryBox.scroll(1);
      this.screen.render();
    });

    this.summaryBox.key(['pageup'], () => {
      this.isUserScrolling = true;
      this.summaryBox.scroll(-10);
      this.screen.render();
    });

    this.summaryBox.key(['pagedown'], () => {
      this.isUserScrolling = true;
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
    if (!this.isUserScrolling) {
      this.resultsBox.setScrollPerc(100); // Auto-scroll to bottom only if user isn't scrolling
    }
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

  async displayResult(result: EvalResult) {
    const displayName = await this.truncatePrompt(result.prompt);
    this.appendResults('{bold}' + this.escapeText(displayName) + ':{/bold}');
    this.appendResults('{blue-fg}Prompt: ' + this.escapeText(result.prompt) + '{/blue-fg}');
    this.appendResults('{gray-fg}Response: ' + this.escapeText(result.response) + '{/gray-fg}');

    result.checkResults.forEach((cond: ConditionalResult) => {
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

  async displaySummary(results: EvalResult[], totalTimeMs?: number) {
    // Store results for later use when exiting
    this.lastResults = results;
    this.lastTotalTime = totalTimeMs || null;

    // Write run output to file
    await this.writeRunOutput(results, totalTimeMs);

    const lines: string[] = [];

    lines.push('{bold}' + '─'.repeat(TABLE_WIDTH) + '{/bold}');
    lines.push('{bold}✨ VIBE CHECK SUMMARY ✨{/bold}');
    lines.push('{bold}' + '─'.repeat(TABLE_WIDTH) + '{/bold}');
    lines.push('');

    // Find the longest eval name for padding - use truncated prompts
    const displayNames = await Promise.all(results.map(r => this.truncatePrompt(r.prompt)));
    
    // Calculate padding to use full table width minus space for results
    // Reserve space for: "  " + "|" + "  " + "✅" + " in X.Xs" (approximately 15 chars)
    const resultsSpace = 15;
    const maxNameLength = Math.max(TABLE_WIDTH - resultsSpace, 20);

    // Get stringWidth function for padding calculation
    const stringWidth = await getStringWidth();

    // Display each eval with visual bar chart
    results.forEach((result, index) => {
      const displayName = displayNames[index];
      const nameWidth = stringWidth(displayName);
      const padding = Math.max(0, maxNameLength - nameWidth);
      const paddedName = displayName + ' '.repeat(padding);

      // Calculate pass/fail counts for checks
      const passedChecks = result.checkResults.filter(c => c.passed).length;
      const failedChecks = result.checkResults.filter(c => !c.passed).length;

      // Create visual bar
      const failBar = '-'.repeat(failedChecks);
      const passBar = '+'.repeat(passedChecks);

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
    lines.push('{bold}' + '─'.repeat(TABLE_WIDTH) + '{/bold}');

    let vibeStatus = '🚩 bad vibes';
    let color = 'red-fg';
    if (passRate > 80) {
      color = 'green-fg';
      vibeStatus = '✨ good vibes';
    } else if (passRate >= 50) {
      color = 'yellow-fg';
      vibeStatus = '😬 sketchy vibes';
    }

    lines.push('{' + color + '}Vibe Rating: ' + passedEvals + '/' + totalEvals + ' (' + passRate.toFixed(1) + '%) - ' + vibeStatus + '{/' + color + '}');
    if (totalTimeMs) {
      lines.push('{cyan-fg}Total Time: ' + (totalTimeMs / 1000).toFixed(2) + 's{/cyan-fg}');
    }
    lines.push('{bold}' + '─'.repeat(80) + '{/bold}');
    lines.push('');

    if (passRate < 50) {
      lines.push('{red-fg}🚩 Bad vibes detected: Vibe rating below 50%{/red-fg}');
    } else {
      lines.push('{green-fg}✨ Good vibes all around!{/green-fg}');
    }

    this.summaryBox.setContent(lines.join('\n'));
    if (!this.isUserScrolling) {
      this.summaryBox.setScrollPerc(100); // Auto-scroll to bottom only if user isn't scrolling
    }

    // Auto-focus the results box so user can scroll immediately
    this.summaryBox.focus();
    this.screen.render();
  }

  async printSummaryToConsole() {
    if (!this.lastResults) {
      return;
    }

    const chalk = require('chalk');
    const results = this.lastResults;
    const totalTimeMs = this.lastTotalTime;

    console.log();
    console.log(chalk.bold('─'.repeat(TABLE_WIDTH)));
    console.log(chalk.bold('✨ VIBE CHECK SUMMARY ✨'));
    console.log(chalk.bold('─'.repeat(TABLE_WIDTH)));
    console.log();

    // Find the longest eval name for padding - use truncated prompts
    const displayNames = await Promise.all(results.map(r => this.truncatePrompt(r.prompt)));
    
    // Calculate padding to use full table width minus space for results
    // Reserve space for: "  " + "|" + "  " + "✅" + " in X.Xs" (approximately 15 chars)
    const resultsSpace = 15;
    const maxNameLength = Math.max(TABLE_WIDTH - resultsSpace, 20);

    // Get stringWidth function for padding calculation
    const stringWidth = await getStringWidth();

    // Display each eval with visual bar chart
    results.forEach((result, index) => {
      const displayName = displayNames[index];
      const nameWidth = stringWidth(displayName);
      const padding = Math.max(0, maxNameLength - nameWidth);
      const paddedName = displayName + ' '.repeat(padding);

      // Calculate pass/fail counts for checks
      const passedChecks = result.checkResults.filter(c => c.passed).length;
      const failedChecks = result.checkResults.filter(c => !c.passed).length;

      // Create visual bar
      const failBar = '-'.repeat(failedChecks);
      const passBar = '+'.repeat(passedChecks);

      // Format time
      const timeStr = result.executionTimeMs
        ? `in ${(result.executionTimeMs / 1000).toFixed(1)}s`
        : '';

      const coloredFailBar = chalk.redBright(failBar);
      const coloredPassBar = chalk.green(passBar);
      const status = result.passed ? chalk.green('✅') : chalk.redBright('🚩');

      console.log(`${paddedName}  ${coloredFailBar}|${coloredPassBar}  ${status} ${timeStr}`);
    });

    // Calculate pass rate
    const totalEvals = results.length;
    const passedEvals = results.filter(r => r.passed).length;
    const passRate = totalEvals > 0 ? (passedEvals / totalEvals) * 100 : 0;

    console.log();
    console.log(chalk.bold('─'.repeat(TABLE_WIDTH)));

    let passRateColor = chalk.redBright;
    let vibeStatus = '🚩 bad vibes';
    if (passRate > 80) {
      passRateColor = chalk.green;
      vibeStatus = '✨ good vibes';
    } else if (passRate >= 50) {
      passRateColor = chalk.yellow;
      vibeStatus = '😬 sketchy vibes';
    }

    console.log(passRateColor(`Vibe Rating: ${passedEvals}/${totalEvals} (${passRate.toFixed(1)}%) - ${vibeStatus}`));
    if (totalTimeMs) {
      console.log(chalk.cyan(`Total Time: ${(totalTimeMs / 1000).toFixed(2)}s`));
    }
    console.log(chalk.bold('─'.repeat(TABLE_WIDTH)));
    console.log();

    if (passRate < 50) {
      console.log(chalk.redBright('🚩 Bad vibes detected: Vibe rating below 50%\n'));
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

  displayOrgInfo(orgInfo: any) {
    const lines: string[] = [];
    lines.push('{bold}{cyan-fg}Organization Information:{/cyan-fg}{/bold}');
    lines.push('');
    lines.push('{cyan-fg}Organization:{/cyan-fg} {white-fg}' + this.escapeText(orgInfo.name) + '{/white-fg}');
    lines.push('{cyan-fg}Slug:{/cyan-fg} {white-fg}' + this.escapeText(orgInfo.slug) + '{/white-fg}');
    lines.push('{cyan-fg}Status:{/cyan-fg} {white-fg}' + this.escapeText(orgInfo.status) + '{/white-fg}');
    
    // Color code credits based on amount
    const creditsAmount = `$${orgInfo.credits.toFixed(2)}`;
    const creditsColor = orgInfo.credits < 1.00 ? '{red-fg}' : '{white-fg}';
    lines.push('{cyan-fg}Available Credits:{/cyan-fg} ' + creditsColor + creditsAmount + '{/white-fg} {gray-fg}(Credit balance may be delayed.){/gray-fg}');
    
    lines.push('{cyan-fg}Created:{/cyan-fg} {gray-fg}' + new Date(orgInfo.created_at).toLocaleString() + '{/gray-fg}');
    lines.push('');

    this.displayInfo(lines.join('\n'));
  }

  displaySuites(suites: any[]) {
    const lines: string[] = [];
    
    if (suites.length === 0) {
      lines.push('{yellow-fg}No suites found{/yellow-fg}');
    } else {
      lines.push('{bold}Available Suites:{/bold}');
      lines.push('');
      lines.push('{bold}Name'.padEnd(30) + 'Last Run'.padEnd(25) + 'Last Edit'.padEnd(25) + '# Evals{/bold}');
      lines.push('='.repeat(100));

      suites.forEach((suite: any) => {
        const lastRun = suite.lastRun ? new Date(suite.lastRun).toLocaleString() : 'Never';
        const lastEdit = new Date(suite.lastEdit).toLocaleString();

        lines.push(
          '{cyan-fg}' + suite.name.padEnd(30) + '{/cyan-fg}' +
          '{gray-fg}' + lastRun.padEnd(25) + '{/gray-fg}' +
          '{gray-fg}' + lastEdit.padEnd(25) + '{/gray-fg}' +
          '{white-fg}' + suite.evalCount + '{/white-fg}'
        );
      });
    }

    lines.push('');
    this.displayInfo(lines.join('\n'));
  }

  displaySuite(suite: any) {
    const lines: string[] = [];
    lines.push('{bold}{cyan-fg}Suite: ' + this.escapeText(suite.name) + '{/cyan-fg}{/bold}');
    lines.push('');
    lines.push('{gray-fg}' + this.escapeText(suite.yamlContent) + '{/gray-fg}');
    lines.push('');

    this.displayInfo(lines.join('\n'));
  }

  displayRuns(runs: any[]) {
    const lines: string[] = [];
    
    if (runs.length === 0) {
      lines.push('{yellow-fg}No runs found{/yellow-fg}');
    } else {
      lines.push('{bold}Available Runs:{/bold}');
      lines.push('');
      lines.push('{bold}ID'.padEnd(20) + 'Suite'.padEnd(25) + 'Status'.padEnd(15) + 'Success'.padEnd(10) + 'Duration'.padEnd(12) + 'Created{/bold}');
      lines.push('='.repeat(120));

      runs.forEach((run: any) => {
        const successRate = run.successRate !== undefined ? `${run.successRate.toFixed(1)}%` : 'N/A';
        const duration = run.duration ? `${(run.duration / 1000).toFixed(1)}s` : 'N/A';
        const created = new Date(run.created_at).toLocaleString();

        let statusColor = '{gray-fg}';
        if (run.status === 'completed') statusColor = '{green-fg}';
        else if (run.status === 'failed') statusColor = '{red-fg}';
        else if (run.status === 'running') statusColor = '{yellow-fg}';

        lines.push(
          '{cyan-fg}' + run.id.substring(0, 19).padEnd(20) + '{/cyan-fg}' +
          '{white-fg}' + (run.suite_name || 'N/A').padEnd(25) + '{/white-fg}' +
          statusColor + run.status.padEnd(15) + '{/white-fg}' +
          '{white-fg}' + successRate.padEnd(10) + '{/white-fg}' +
          '{white-fg}' + duration.padEnd(12) + '{/white-fg}' +
          '{gray-fg}' + created + '{/gray-fg}'
        );
      });
    }

    lines.push('');
    this.displayInfo(lines.join('\n'));
  }

  displayRun(run: any) {
    const lines: string[] = [];
    lines.push('{bold}{cyan-fg}Run Details:{/cyan-fg}{/bold}');
    lines.push('');
    lines.push('{cyan-fg}ID:{/cyan-fg} {white-fg}' + this.escapeText(run.id) + '{/white-fg}');
    lines.push('{cyan-fg}Suite:{/cyan-fg} {white-fg}' + this.escapeText(run.suite_name || 'N/A') + '{/white-fg}');
    lines.push('{cyan-fg}Status:{/cyan-fg} {white-fg}' + this.escapeText(run.status) + '{/white-fg}');
    lines.push('{cyan-fg}Success Rate:{/cyan-fg} {white-fg}' + (run.successRate !== undefined ? `${run.successRate.toFixed(1)}%` : 'N/A') + '{/white-fg}');
    lines.push('{cyan-fg}Duration:{/cyan-fg} {white-fg}' + (run.duration ? `${(run.duration / 1000).toFixed(1)}s` : 'N/A') + '{/white-fg}');
    lines.push('{cyan-fg}Created:{/cyan-fg} {gray-fg}' + new Date(run.created_at).toLocaleString() + '{/gray-fg}');
    
    if (run.results && run.results.length > 0) {
      lines.push('');
      lines.push('{bold}Results:{/bold}');
      run.results.forEach((result: any, index: number) => {
        const status = result.passed ? '{green-fg}✅ PASS{/green-fg}' : '{red-fg}🚩 FAIL{/red-fg}';
        lines.push(`  ${index + 1}. ${status} ${this.escapeText(result.prompt.substring(0, 50))}...`);
      });
    }
    
    lines.push('');
    this.displayInfo(lines.join('\n'));
  }

  displayModels(models: any[], filters: any = {}) {
    const lines: string[] = [];
    
    if (models.length === 0) {
      lines.push('{yellow-fg}No models available{/yellow-fg}');
    } else {
      // Build filter description
      let filterDesc = '';
      if (filters.mcp || filters.price || filters.provider) {
        const filterParts: string[] = [];
        if (filters.mcp) filterParts.push('MCP only');
        if (filters.price) filterParts.push(`Price: ${filters.price}`);
        if (filters.provider) filterParts.push(`Provider: ${filters.provider}`);
        filterDesc = ` [${filterParts.join('] [')}]`;
      }

      lines.push('{bold}Models (' + models.length + ')' + filterDesc + '{/bold}');
      lines.push('');
      lines.push('{bold}ID'.padEnd(40) + 'Description'.padEnd(50) + 'MCP'.padEnd(5) + 'Price{/bold}');
      lines.push('-'.repeat(101));

      models.forEach((model: any) => {
        const id = String(model.id || '');
        const desc = String(model.description || model.name || '');
        const mcp = Array.isArray(model.supported_parameters) && model.supported_parameters.includes('tools') ? 'yes' : 'no';
        
        // Simple price tier calculation (simplified for display)
        const hasPricing = model.pricing?.prompt && model.pricing?.completion;
        const priceTier = hasPricing ? '$$' : '-';

        lines.push(
          '{cyan-fg}' + id.padEnd(40) + '{/cyan-fg}' +
          '{gray-fg}' + desc.padEnd(50) + '{/gray-fg}' +
          (mcp === 'yes' ? '{green-fg}' : '{gray-fg}') + mcp.padEnd(5) + '{/white-fg}' +
          '{white-fg}' + priceTier + '{/white-fg}'
        );
      });
    }

    lines.push('');
    this.displayInfo(lines.join('\n'));
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

  private async truncatePrompt(prompt: string, maxLength: number = 100): Promise<string> {
    const stringWidth = await getStringWidth();
    const visualWidth = stringWidth(prompt);
    if (visualWidth <= maxLength) {
      return prompt;
    }
    
    // Truncate by visual width, not character count
    let truncated = '';
    let currentWidth = 0;
    
    for (const char of prompt) {
      const charWidth = stringWidth(char);
      if (currentWidth + charWidth > maxLength - 3) {
        break;
      }
      truncated += char;
      currentWidth += charWidth;
    }
    
    return truncated + '...';
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
      '{cyan-fg}:check [file]{/cyan-fg}        - Run evaluation file (or current file)',
      '{cyan-fg}:get suites{/cyan-fg}          - List all evaluation suites',
      '{cyan-fg}:get suite <name>{/cyan-fg}    - Get specific suite YAML',
      '{cyan-fg}:get runs [options]{/cyan-fg}  - List runs (--suite, --status, --limit, etc.)',
      '{cyan-fg}:get run <id>{/cyan-fg}        - Get specific run details',
      '{cyan-fg}:get models [options]{/cyan-fg} - List models (--mcp, --price, --provider)',
      '{cyan-fg}:get org{/cyan-fg}             - Show organization info and credits',
      '{cyan-fg}:exit, :quit, :q{/cyan-fg}     - Exit the interactive mode',
      '',
      '{bold}{yellow-fg}Navigation:{/yellow-fg}{/bold}',
      '',
      '{cyan-fg}Tab{/cyan-fg}              - Cycle focus: Results → Summary → Command input',
      '{cyan-fg}↑/↓ or j/k{/cyan-fg}      - Scroll focused pane',
      '{cyan-fg}Page Up/Down{/cyan-fg}    - Fast scroll focused pane',
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

  async writeRunOutput(results: EvalResult[], totalTimeMs?: number) {
    if (!this.currentRunId) {
      return;
    }

    try {
      const outputPath = await writeRunOutputToFile({
        runId: this.currentRunId,
        results,
        totalTimeMs,
        yamlContent: this.yamlContent || undefined,
        runLog: this.runLog,
        outputDir: this.outputDir
      });
      this.displayInfo(`Output saved to: ${outputPath}`);
    } catch (error: any) {
      this.displayError(`Failed to write output file: ${error.message}`);
    }
  }

  render() {
    this.screen.render();
  }

  destroy() {
    try {
      // Suppress terminal capability errors during cleanup
      const originalStderrWrite = process.stderr.write;
      process.stderr.write = (() => {}) as any;
      this.screen.destroy();
      // Restore stderr
      process.stderr.write = originalStderrWrite;
    } catch (error) {
      // Ignore blessed cleanup errors
    }
  }
}
