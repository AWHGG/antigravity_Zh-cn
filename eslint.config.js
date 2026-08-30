// ESLint 平面配置：README 承诺 src/ 源文件"可 lint"，此处兑现承诺。
// 仅做语法与低级错误防护（no-undef / no-redeclare 等），不做风格约束，
// 避免与既有代码风格产生大规模无意义告警。
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    js.configs.recommended,
    {
        ignores: ['node_modules/**']
    },
    {
        // src/ 源文件：渲染层/共享内核/主进程核心，构建期由宿主拼装注入
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.browser,
                // 构建期注入标识：宿主把共享内核（含字典与版本号）拼入各源文件后可用，
                // 独立 lint 源文件时按只读全局处理
                DICT_PLACEHOLDER: 'readonly',
                RENDERER_CODE_PLACEHOLDER: 'readonly',
                AG_I18N_VERSION: 'readonly',
                norm: 'readonly',
                lookup: 'readonly',
                translateString: 'readonly',
                translateWithShortcut: 'readonly',
                translateDynamicText: 'readonly',
                isCodeLikeText: 'readonly',
                translateCompoundTitle: 'readonly'
            }
        },
        rules: {
            // 拦截器与防御式代码大量使用空 catch（失败即静默降级），按需放宽
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }]
        }
    },
    {
        // 宿主与维护脚本：Node.js 环境
        files: ['localization_engine.js', 'scratch/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { ...globals.node }
        },
        rules: {
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }]
        }
    }
];
