const acorn = require("acorn")
const fs = require("fs")
const path = require("path")
const through = require('through2')
const PluginError = require('gulp-util').PluginError

const PLUGIN_NAME = 'gulp-js-text-imports'

const noTransform = (content, path, callback) => callback(null, content)

module.exports = (options) => {
    options = options || {}
    options.acceptedExtensions = options.acceptedExtensions || [
        'html',
        'css'
    ]
    options.handlers = options.handlers || {}
    options.parserOptions = options.parserOptions || {}
    options.parserOptions.ecmaVersion = options.parserOptions.ecmaVersion || 7
    options.parserOptions.sourceType = options.parserOptions.sourceType || 'module'

    let acceptedExtensions = Object.keys(options.handlers)
    acceptedExtensions = acceptedExtensions.concat(
        options.acceptedExtensions
            .filter(ext => acceptedExtensions.indexOf(ext) < 0)
    )
    acceptedExtensions
        .filter(ext => !options.handlers[ext])
        .forEach(ext => options.handlers[ext] = noTransform)
    options.acceptedExtensions = Object.keys(options.handlers)
        .map(ext => ext.startsWith('.') ? ext : '.' + ext)

    let transform = function (file, encoding, callback) {
        if (file.isNull())
            return callback(null, file)

        if (file.isStream())
            return this.emit('error', new PluginError(PLUGIN_NAME, 'Streams not supported!'))

        if (file.isBuffer()) {
            let source = file.contents.toString()
            let parsed = acorn.parse(source, options.parserOptions)
            let processImports = parsed.body.filter(node => {
                // Look for import declarations, importing files with specified extensions
                if (
                    node.type == 'ImportDeclaration'
                    && node.source.type == 'Literal'
                    && node.source.value
                ) {
                    let ext = path.extname(node.source.value).toLowerCase()
                    if (options.acceptedExtensions.indexOf(ext) >= 0)
                        return true
                }
                return false
            }).filter(node => {
                // Look for default imports, i.e. `import name from 'path'`
                if (
                    node.specifiers
                    && node.specifiers.length
                ) {
                    let specifiers = node.specifiers.filter(specifier => specifier.type == 'ImportDefaultSpecifier')
                    if (
                        specifiers.length == 1
                        && specifiers[0].local.type == 'Identifier'
                    )
                        return true
                }
                return false
            }).map(node => {
                return {
                    matchStart: node.start,
                    matchEnd: node.end,
                    match: source.substr(node.start, node.end - node.start),
                    targetFile: path.resolve(path.join(path.dirname(file.path), node.source.value)),
                    targetVariable: node.specifiers.filter(specifier => specifier.type == 'ImportDefaultSpecifier')[0].local.name
                }
            }).map(imp => new Promise((resolve, reject) =>
                fs.readFile(imp.targetFile, 'utf8', (err, content) => {
                    if (err)
                        return reject(err)

                    let ext = path.extname(imp.targetFile)
                        .substr(1)
                        .toLowerCase()

                    if (options.handlers[ext])
                        options.handlers[ext](content, imp.targetFile, (err, newContent) => {
                            if (err)
                                return reject(err)

                            imp.targetContent = newContent
                            resolve(imp)
                        })
                    else {
                        imp.targetContent = content
                        resolve(imp)
                    }
                })
            ))

            Promise.all(processImports)
                .then(imports => {
                    imports
                        .sort((a, b) => b.matchStart - a.matchStart)
                        .forEach(imp => {
                            source = source.substr(0, imp.matchStart)
                                + 'const ' + imp.targetVariable + ' = ' + JSON.stringify(imp.targetContent || '') + ';'
                                + source.substr(imp.matchEnd)
                        })
                    file.contents = new Buffer(source)
                })
                .then(() => callback(null, file))
                .catch(err => callback(err, null))
        }
    }

    return through.obj(transform)
}