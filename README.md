# Gulp JS text imports
Gulp plugin to inline `import name from './file.html';` as `const name = "content of file.html file";`, with support for content transformations

# Install
```
npm install --save-dev gulp-js-text-imports
```

# Usage
```js
const gulp = require('gulp');
const importsInliner = require('gulp-js-text-imports');
const htmlMinify = require('html-minifier').minify;

gulp.task('default', () => {
    return gulp.src('./src/**/*.js')
        .pipe(importsInliner({
            handlers: {
                'html': (content, path, callback) => callback(null, htmlMinify(content, {
                    collapseWhitespace: true
                }))
            }
        }))
        .pipe(gulp.dest('./dest'))
})
```

## Config
Gulp JS text imports plugin supports the following config options:

#### `acceptedExtensions: ['html', 'css']`
Files with listed extensions will be inlined. Unles a coresponding handler is defined for an extension, the content of a file is escaped and inlined into the source file.

#### `handlers: { extension: (content, path, callback) => callback(err, transformedContent) }`
Optional handler functions to transform content prior to inlining, such as minifying HTML, and processing SASS.

#### `parserOptions: { ecmaVersion: 7, sourceType: 'module' }`
[Acorn](https://github.com/ternjs/acorn) parser options. This plugin is meant to work with ES6 module imports, therefore changing the `sourceType` option most likey won't work.