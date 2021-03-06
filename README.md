# postcss-copy [![Build Status](https://travis-ci.org/geut/postcss-copy.svg?branch=master)](https://travis-ci.org/geut/postcss-copy)
> An **async** postcss plugin to copy all assets referenced in CSS files to a custom destination folder and updating the URLs.

## Install

With [npm](https://npmjs.com/package/postcss-copy) do:

```
npm install postcss-copy
```

## Quick Start

### Using [Gulp](https://github.com/postcss/gulp-postcss)

```js
var gulp = require('gulp');
var postcss = require('gulp-postcss');
var postcssCopy = require('postcss-copy');

gulp.task('buildCss', function () {
    var processors = [
        postcssCopy({
            src: 'src',
            dest: 'dist'
        })
    ];

    return gulp
        .src('src/**/*.css')
        .pipe(postcss(processors))
        .pipe(gulp.dest('dist'));
});
```

## Options

##### src ({string|array} required)
Define the base src path of your CSS files.

##### dest ({string} required)
Define the dest path of your CSS files and assets.

##### template (default = 'assets/[hash].[ext]')
Define a template name for your final url assets.
* **[hash]**: Let you use a hash name based on the contents of the file.
* **[name]**: Real name of your asset.
* **[path]**: Original relative path of your asset.
* **[ext]**: Extension of the asset.

##### hashFunction
Define a custom function to create the hash name.
```js
var copyOpts = {
    ...,
    hashFunction(contents) {
        // borschik
        return crypto.createHash('sha1')
            .update(contents)
            .digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '')
            .replace(/^[+-]+/g, '');
    }
};
```

#####  keepRelativePath (default = true)
By default the copy process keep the relative path between each ```asset``` and the path of his  ```CSS file```. You can change this behavior setting the option in false and each ```asset``` will define the path based only in the ```dest``` path option (see [Using copy with postcss-import](#using-postcss-import))

##### transform
Extend the copy method to apply a transform in the contents (e.g: optimize images).

**IMPORTANT:** The function must return the fileMeta (modified) or a promise using ```resolve(fileMeta)```.
```js
var Imagemin = require('imagemin');

var copyOpts = {
    ...,
    transform(fileMeta) {
        return new Promise((resolve, reject) => {
            if (['jpg', 'png'].indexOf(fileMeta.ext) === -1) {
                return fileMeta;
            }
            new Imagemin()
                .src(fileMeta.contents)
                .use(Imagemin.jpegtran({
                    progressive: true
                }))
                .run((err, files) => {
                    if (err) {
                        reject(err);
                    }
                    fileMeta.contents = files[0].contents;
                    resolve(fileMeta); // <- important
                });
        });
    }
};
```

## <a name="using-postcss-import"></a> Using copy with postcss-import
[postcss-import](https://github.com/postcss/postcss-import) is a great plugin that allow us work our css files in a modular way with the same behavior of CommonJS.
Since this plugin create at the end only one file with all your CSS files inline (loaded with the @import keyword) you need disabled in ```copy``` the option ```keepRelativePath```.

One thing more...
postcss-import has the ability of load files from node_modules. If your src folder is at the same level of node_modules like this:
```
myProject/
|-- node_modules/
|-- dest/
|-- src/
```
In this case you need define ```a multiple src```

```js
var gulp = require('gulp');
var postcss = require('gulp-postcss');
var postcssCopy = require('postcss-copy');
var postcssImport = require('postcss-import');

gulp.task('buildCss', function () {
    var processors = [
        postcssImport(),
        postcssCopy({
            src: ['src', 'node_modules'],
            dest: 'dist',
            keepRelativePath: false // required to work with postcss-import
        })
    ];

    return gulp
        .src('src/index.css')
        .pipe(postcss(processors))
        .pipe(gulp.dest('dist'));
});
```

## On roadmap

nothing for now :)

## Credits

* Thanks to @conradz and his rework plugin [rework-assets](https://github.com/conradz/rework-assets) my inspiration in this plugin.
* Thanks to @MoOx for let me create the copy function in his [postcss-url](https://github.com/postcss/postcss-url) plugin.
* Thanks to @webpack, i take the idea of define templates from his awesome [file-loader](https://github.com/webpack/file-loader)

## License

MIT
