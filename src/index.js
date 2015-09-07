import postcss from 'postcss';
import path from 'path';
import reduceFunctionCall from 'reduce-function-call';
import fs from 'fs';
import url from 'url';
import crypto from 'crypto';
import pathExists from 'path-exists';
import mkdirp from 'mkdirp';
import {
    _extend
}
from 'util';

const tags = [
    'path',
    'name',
    'hash',
    'ext'
];

/**
 * return quote type
 *
 * @param  {String} string quoted (or not) value
 * @return {String} quote if any, or empty string
 */
function getUrlMetaData(string) {
    let quote = '';
    const quotes = ['\"', '\''];
    const trimedString = string.trim();
    quotes.forEach((q) => {
        if (
            trimedString.charAt(0) === q &&
            trimedString.charAt(trimedString.length - 1) === q
        ) {
            quote = q;
        }
    });

    const urlMeta = {
        before: string.slice(0, string.indexOf(quote)),
        quote: quote,
        value: quote ?
            trimedString.substr(1, trimedString.length - 2)
            : trimedString,
        after: string.slice(string.lastIndexOf(quote) + 1)
    };
    return urlMeta;
}

/**
 * Create an css url() from a path and a quote style
 *
 * @param {String} urlMeta url meta data
 * @param {String} newPath url path
 * @return {String} new url()
 */
function createUrl(urlMeta, newPath) {
    return 'url(' +
        urlMeta.before +
        urlMeta.quote +
        (newPath || urlMeta.value) +
        urlMeta.quote +
        urlMeta.after +
        ')';
}

/**
 * readFile
 *
 * function to read the src file
 *
 * @param  {string} filepath
 * @return {contents|boolean}
 */
function readFile(filepath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filepath, (err, data) => {
            if (err) {
                reject(`Can't read the file in ${filepath}`);
            } else {
                resolve(data);
            }
        });
    });
}

/**
 * writeFile
 *
 * function to write the asset file in dest
 *
 * @param  {string} filepath
 * @param  {string} content
 * @return {contents|boolean}
 */
function writeFile(fileMeta) {
    return new Promise((resolve, reject) => {
        fs.writeFile(fileMeta.resultAbsolutePath, fileMeta.content, (err) => {
            if (err) {
                reject(`Can't write in ${fileMeta.resultAbsolutePath}`);
            } else {
                resolve(fileMeta);
            }
        });
    });
}

/**
 * [fileExists description]
 * @param  {[type]} filepath [description]
 * @return {[type]}          [description]
 */
function copyFile(fileMeta) {
    return pathExists(fileMeta.resultAbsolutePath)
        .then((exists) => {
            if (!exists) {
                mkdirp.sync(path.dirname(fileMeta.resultAbsolutePath));
            }
            return writeFile(fileMeta);
        });
}

/**
 * getFileMeta
 *
 * Helper function that reads the file ang get some helpful information
 * to the copy process.
 *
 * @param  {string} dirname
 * @param  {string} value
 * @param  {Object} options
 * @return {Object} meta information from the resource
 */
function getFileMeta(dirname, value, opts) {
    const parseUrl = url.parse(path.resolve(dirname, value), true);
    return readFile(parseUrl.pathname)
        .then((content) => {
            const fileMeta = {};
            fileMeta.content = content;
            fileMeta.hash = opts.hashFunction(fileMeta.content);
            fileMeta.fullName = path.basename(parseUrl.pathname);
            // name without extension
            fileMeta.name = path.basename(
                parseUrl.pathname,
                path.extname(parseUrl.pathname)
            );
            // extension without the '.'
            fileMeta.ext = path.extname(parseUrl.pathname).replace('.', '');
            // the absolute path without the #hash param
            fileMeta.absolutePath = parseUrl.pathname;
            // path between the basePath and the filename
            fileMeta.path = fileMeta
                .absolutePath
                .replace(opts.src, '')
                .replace(fileMeta.fullName, '')
                .replace(/^\/+|\/+$/gm, '');
            fileMeta.extra = (parseUrl.search ? parseUrl.search : '') +
                (parseUrl.hash ? parseUrl.hash : '');

            return fileMeta;
        });
}

/**
 * processCopy
 *
 * @param {Object} result
 * @param {Object} urlMeta url meta data
 * @param {Object} options
 * @param {Object} decl postcss declaration
 * @return {String} new url
 */
function processCopy(result, urlMeta, opts, decl) {
    /**
     * dirname of the read file css
     * @type {String}
     */
    const dirname = decl.source && decl.source.input
        ? path.dirname(decl.source.input.file)
        : opts.src;

    return getFileMeta(dirname, urlMeta.value, opts)
        .then((fileMeta) => {
            let tpl = opts.template;
            tags.forEach((tag) => {
                tpl = tpl.replace(
                    '[' + tag + ']',
                    fileMeta[tag] ? fileMeta[tag] : opts[tag]
                );
            });
            fileMeta.resultAbsolutePath = path.resolve(opts.dest, tpl);

            return copyFile(fileMeta);
        })
        .then((fileMeta) => {
            const resultUrl = path.relative(
                opts.keepRelativePath
                    ? dirname.replace(opts.src, opts.dest)
                    : opts.dest,
                fileMeta.resultAbsolutePath
            ) + fileMeta.extra;

            return createUrl(urlMeta, resultUrl);
        })
        .catch((err) => {
            decl.warn(result, err);
            return createUrl(urlMeta);
        });
}

/**
 * Processes one declaration
 *
 * @param {Object} result
 * @param {Object} decl  postcss declaration
 * @param {Object} options plugin options
 * @return {void}
 */
function processDecl(result, decl, opts) {
    return new Promise((resolve) => {
        reduceFunctionCall(decl.value, 'url', (value) => {
            const urlMeta = getUrlMetaData(value);

            // ignore absolute urls, hasshes or data uris
            if (urlMeta.value.indexOf('/') === 0 ||
                urlMeta.value.indexOf('data:') === 0 ||
                urlMeta.value.indexOf('#') === 0 ||
                /^[a-z]+:\/\//.test(urlMeta.value)
            ) {
                decl.value = createUrl(urlMeta);
                resolve();
                return;
            }

            processCopy(result, urlMeta, opts, decl)
                .then((newUrl) => {
                    decl.value = newUrl;
                    resolve();
                })
                .catch((error) => {
                    result.warn(error, {
                        node: decl
                    });
                });
        });
    });
}

/**
 * Initialize the postcss-copy plugin
 * @param  {Object} plugin options
 * @return {void}
 *
 * userOpts = {
 * 		src: {String} optional
 * 		dest: {String} optional
 *      template: {String} optional (default 'assets/[hash].[ext]')
 * }
 */
function init(userOpts = {}) {
    let opts = {
        template: 'assets/[hash].[ext]',
        keepRelativePath: true,
        hashFunction(content) {
            return crypto.createHash('sha1')
                .update(content)
                .digest('hex')
                .substr(0, 16);
        }
    };
    opts = _extend(opts, userOpts);

    return (style, result) => {
        if (opts.src) {
            opts.src = path.resolve(opts.src);
        } else {
            throw new Error('Option `src` is required in postcss-copy');
        }
        if (opts.dest) {
            opts.dest = path.resolve(opts.dest);
        } else {
            throw new Error('Option `dest` is required in postcss-copy');
        }

        return new Promise((resolve, reject) => {
            const promises = [];
            style.walkDecls(decl => {
                if (decl.value && decl.value.indexOf('url(') > -1) {
                    promises.push(processDecl(result, decl, opts));
                }
            });
            Promise.all(promises).then(resolve, reject);
        });
    };
}

export default postcss.plugin('postcss-copy', init);
