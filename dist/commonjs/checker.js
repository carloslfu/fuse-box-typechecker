"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var chalk = require("chalk");
var tslint = require("tslint");
var path = require("path");
var interfaces_1 = require("./interfaces");
function isTSError(error) {
    return error.code !== undefined;
}
var Checker = (function () {
    function Checker() {
    }
    Checker.prototype.inspectCode = function (options) {
        var _this = this;
        this.options = options;
        var parseConfigHost = {
            fileExists: ts.sys.fileExists,
            readDirectory: ts.sys.readDirectory,
            readFile: ts.sys.readFile,
            useCaseSensitiveFileNames: true
        };
        var inspectionTimeStart = new Date().getTime();
        var parsed = ts.parseJsonConfigFileContent(this.options.tsConfigJsonContent, parseConfigHost, options.basePath || '.', undefined);
        this.program = ts.createProgram(parsed.fileNames, parsed.options, undefined, this.program);
        this.tsDiagnostics = [];
        var optionsErrors = this.program.getOptionsDiagnostics().map(function (obj) {
            obj._type = 'options';
            return obj;
        });
        this.tsDiagnostics = this.tsDiagnostics.concat(optionsErrors);
        var globalErrors = this.program.getGlobalDiagnostics().map(function (obj) {
            obj._type = 'global';
            return obj;
        });
        this.tsDiagnostics = this.tsDiagnostics.concat(globalErrors);
        var syntacticErrors = this.program.getSyntacticDiagnostics().map(function (obj) {
            obj._type = 'syntactic';
            return obj;
        });
        this.tsDiagnostics = this.tsDiagnostics.concat(syntacticErrors);
        var semanticErrors = this.program.getSemanticDiagnostics().map(function (obj) {
            obj._type = 'semantic';
            return obj;
        });
        this.tsDiagnostics = this.tsDiagnostics.concat(semanticErrors);
        this.lintFileResult = [];
        if (options.tsLint) {
            var fullPath = path.resolve(this.options.basePath, options.tsLint);
            var files = tslint.Linter.getFileNames(this.program);
            var tsLintConfiguration_1 = tslint.Configuration.findConfiguration(fullPath, this.options.basePath).results;
            this.lintFileResult =
                files.map(function (file) {
                    var fileContents = _this.program.getSourceFile(file).getFullText();
                    var linter = new tslint.Linter(options.lintoptions, _this.program);
                    linter.lint(file, fileContents, tsLintConfiguration_1);
                    return linter.getResult();
                }).filter(function (result) {
                    return result.errorCount ? true : false;
                });
        }
        this.elapsedInspectionTime = new Date().getTime() - inspectionTimeStart;
    };
    Checker.prototype.printResult = function (isWorker) {
        var _this = this;
        var print = this.writeText;
        var program = this.program;
        var options = this.options;
        print(chalk.bgWhite(chalk.black(interfaces_1.END_LINE + "Typechecker plugin(" + options.type + ") " + options.name)) +
            chalk.white("." + interfaces_1.END_LINE));
        print(chalk.grey("Time:" + new Date().toString() + " " + interfaces_1.END_LINE));
        var lintErrorMessages = this.processLintFiles();
        var tsErrorMessages = this.processTsDiagnostics();
        var combinedErrors = tsErrorMessages.concat(lintErrorMessages);
        var groupedErrors = {};
        combinedErrors.forEach(function (error) {
            if (!groupedErrors[error.fileName]) {
                groupedErrors[error.fileName] = [];
            }
            groupedErrors[error.fileName].push(error);
        });
        var allErrors = Object.entries(groupedErrors)
            .map(function (_a) {
            var fileName = _a[0], errors = _a[1];
            var short = _this.options.shortenFilenames;
            var fullFileName = path.resolve(fileName);
            var shortFileName = fullFileName.split(options.basePath).join('.');
            return chalk.white("\u2514\u2500\u2500 " + shortFileName) + interfaces_1.END_LINE + errors.map(function (err) {
                var text = chalk.red('   |');
                if (isTSError(err)) {
                    text += chalk[err.color](" " + (short ? shortFileName : fullFileName) + " (" + err.line + "," + err.char + ") ");
                    text += chalk.white("(" + err.category);
                    text += chalk.white(err.code + ")");
                    text += ' ' + err.message;
                }
                else {
                    text += chalk[err.color](" " + (short ? shortFileName : fullFileName) + " (" + (err.line + 1) + "," + (err.char + 1) + ") ");
                    text += chalk.white("(" + err.ruleSeverity + ":");
                    text += chalk.white(err.ruleName + ")");
                    text += ' ' + err.failure;
                }
                return text;
            }).join(interfaces_1.END_LINE);
        });
        if (allErrors.length > 0) {
            allErrors.unshift(chalk.underline(interfaces_1.END_LINE + "File errors") + chalk.white(':'));
            print(allErrors.join(interfaces_1.END_LINE));
        }
        var optionsErrors = program.getOptionsDiagnostics().length;
        var globalErrors = program.getGlobalDiagnostics().length;
        var syntacticErrors = program.getSyntacticDiagnostics().length;
        var semanticErrors = program.getSemanticDiagnostics().length;
        var tsLintErrors = lintErrorMessages.length;
        var totalsErrors = optionsErrors + globalErrors + syntacticErrors + semanticErrors + tsLintErrors;
        if (totalsErrors) {
            print(chalk.underline("" + interfaces_1.END_LINE + interfaces_1.END_LINE + "Errors") +
                chalk.white(":" + totalsErrors + interfaces_1.END_LINE));
            print(chalk[optionsErrors ? options.yellowOnOptions ? 'yellow' : 'red' : 'white']("\u2514\u2500\u2500 Options: " + optionsErrors + interfaces_1.END_LINE));
            print(chalk[globalErrors ? options.yellowOnGlobal ? 'yellow' : 'red' : 'white']("\u2514\u2500\u2500 Global: " + globalErrors + interfaces_1.END_LINE));
            print(chalk[syntacticErrors ? options.yellowOnSyntactic ? 'yellow' : 'red' : 'white']("\u2514\u2500\u2500 Syntactic: " + syntacticErrors + interfaces_1.END_LINE));
            print(chalk[semanticErrors ? options.yellowOnSemantic ? 'yellow' : 'red' : 'white']("\u2514\u2500\u2500 Semantic: " + semanticErrors + interfaces_1.END_LINE));
            print(chalk[tsLintErrors ? options.yellowOnLint ? 'yellow' : 'red' : 'white']("\u2514\u2500\u2500 TsLint: " + tsLintErrors + interfaces_1.END_LINE + interfaces_1.END_LINE));
        }
        else {
            print(chalk.grey("All good, no errors :-)" + interfaces_1.END_LINE));
        }
        print(chalk.grey("Typechecking time: " + this.elapsedInspectionTime + "ms" + interfaces_1.END_LINE));
        switch (true) {
            case options.throwOnGlobal && globalErrors > 0:
            case options.throwOnOptions && optionsErrors > 0:
            case options.throwOnSemantic && semanticErrors > 0:
            case options.throwOnTsLint && tsLintErrors > 0:
            case options.throwOnSyntactic && syntacticErrors > 0:
                if (process.send) {
                    process.send('error');
                }
                else {
                    throw new Error('Typechecker throwing error due to throw options set');
                }
                process.exit(1);
                break;
            case options.quit && isWorker:
                print(chalk.grey("Quiting typechecker" + interfaces_1.END_LINE + interfaces_1.END_LINE));
                process.send('done');
                break;
            case options.quit && !isWorker:
                print(chalk.grey("Quiting typechecker" + interfaces_1.END_LINE + interfaces_1.END_LINE));
                break;
            default:
                print(chalk.grey("Keeping typechecker alive" + interfaces_1.END_LINE + interfaces_1.END_LINE));
        }
        return totalsErrors;
    };
    Checker.prototype.writeText = function (text) {
        ts.sys.write(text);
    };
    Checker.prototype.processLintFiles = function () {
        var options = this.options;
        var erroredLintFiles = this.lintFileResult
            .filter(function (fileResult) { return fileResult.failures; });
        var errors = erroredLintFiles
            .map(function (fileResult) {
            return fileResult.failures.map(function (failure) { return ({
                fileName: failure.fileName,
                line: failure.startPosition.lineAndCharacter.line,
                char: failure.startPosition.lineAndCharacter.character,
                ruleSeverity: failure.ruleSeverity.charAt(0).toUpperCase() + failure.ruleSeverity.slice(1),
                ruleName: failure.ruleName,
                color: options.yellowOnLint ? 'yellow' : 'red',
                failure: failure.failure
            }); });
        }).reduce(function (acc, curr) { return acc.concat(curr); }, []);
        return errors;
    };
    Checker.prototype.processTsDiagnostics = function () {
        var options = this.options;
        return this.tsDiagnostics
            .filter(function (diag) { return diag.file; })
            .map(function (diag) {
            var color;
            switch (diag._type) {
                case 'options':
                    color = options.yellowOnOptions ? 'yellow' : 'red';
                    break;
                case 'global':
                    color = options.yellowOnGlobal ? 'yellow' : 'red';
                    break;
                case 'syntactic':
                    color = options.yellowOnSyntactic ? 'yellow' : 'red';
                    break;
                case 'semantic':
                    color = options.yellowOnSemantic ? 'yellow' : 'red';
                    break;
                default:
                    color = 'red';
            }
            var _a = diag.file.getLineAndCharacterOfPosition(diag.start), line = _a.line, character = _a.character;
            return {
                fileName: diag.file.fileName,
                line: line + 1,
                message: ts.flattenDiagnosticMessageText(diag.messageText, interfaces_1.END_LINE),
                char: character + 1,
                color: color,
                category: ts.DiagnosticCategory[diag.category] + ":",
                code: "TS" + diag.code
            };
        });
    };
    return Checker;
}());
exports.Checker = Checker;

//# sourceMappingURL=checker.js.map
