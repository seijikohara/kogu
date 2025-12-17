export type {
	AstLanguage,
	AstNode,
	AstNodeType,
	AstParseError,
	AstParseResult,
	AstPosition,
	AstRange,
	LineToPathMap,
	PathToLineMap,
} from './types.js';

export {
	buildLineToPathMap,
	buildPathToLineMap,
	findLineByPath,
	findPathByLine,
	parseToAst,
} from './parser.js';
