# Building deck.gl

This article contains additional information on options for how to build deck.gl.


## Optimizing for Bundle Size

deck.gl and luma.gl provide a lot of functionality and the amount of code these libraries contain will of course impact the size of your application bundle and your startup load time.

There are multiple techniques used in JavaScript.


### Choosing a dist folder

When installed from npm, deck.gl and related libraries come with three separate `dist` sub folders.

| Folder     | `mainField` | Description   |
| ---        | ---         | --- |
| `dist/es5` | `main`      | All code is transpiled into ES5 and exports/imports are transpiled into `commonjs` requires. The main reason to use this distribution is if your bundler does not support tree-shaking using `import`/`export` |
| `dist/esm` | `module`    | Same as `dist/es5`, except `export` and `import` statements are left untranspiled to enable tree shaking. |
| `dist/es6` | `esnext`    | This distribution uses `babel-preset-env` and with very few exceptions essentially untranspiled ES6/ES2015 code. This is the smallest distribution, that will three-shake best, and is intended to be the best choice if you are only targeting "evergreen" browsers. |

You will have to check the documentation of your particular bundler to see what configuration options are available:
* Webpack 4 allows you to choose the `esnext` distribution by specifying a `resolve.mainFields` array.
* Webpack 2 and later will pick `module` main field over `main` if it is available
For other bundlers, please refer to the respective documentation


### About Tree-Shaking

deck.gl was designed from the start to leverage tree-shaking. This technique has been talked about for quite some time but has been slow in actually providing the expected benefits. With the combination of webpack 4 and babel 7 we are finally starting to see significant results, so you may want to experiment with upgrading your bundler if you are not getting results.

Note that tree-shaking still has limitations:
* At least in webpack, tree shaking is done by the uglifierm, which is typically only run on production builds, so it is typically not possible to assess the benefits of tree shaking during development. In addition, this makes it even harder to make statements about bundle size impact from looking at bundle sizes in development builds. The recommendation is to always measure impact on your final production builds.
* Static dependency analyzers err on the side of safety and will still include any symbol it is not sure will never be used.
* This is compounded by the fact that there are side effects in various language feature that complicate or defeat current static dependency analysis techniques, causing "dead code" to still be bundled. The good news is that the analyzers are getting better.
* Naturally, an application that uses all the functionality offered by the library will benefit little from tree shaking, whereas a small app that only uses a few layers should expect bigger savings.


### Bundle Size Number

So, what bundle size impact should you expect? When do you know if you have set up your bundler optimally. To help answer these questions, we provide some numbers you can compare against. deck.gl has scripts that measure the size of a minified bundle after each build, which allows us to provide comparison numbers between releases.

> TBA - Table needs updating


| Dist | 5.1.4 Bundle (Compressed) | 5.2.0 Bundle (Compressed) | Comments |
| ---  | ---                       | ---                       | --- |
| ES6  | N/A                       | 560 KB (156 KB)           | New dist in 5.2.0                  |
| ESM  | 708 KB (169 KB)           | 724 KB (172 KB)           | Transpiled, tree-shaking enabled   |
| ES5  | 754 KB (176 KB)           | 760 KB (176 KB)           | Transpiled to ES5, no tree-shaking |

Number are for minified bundle size, with compressed bundle size in parenthesis. Compressed bundle sizes are calculated using `gzip -9`. `brotli` compression typically provides an additional 20% reduction.

Note that these numbers are not the final word on deck.gl bundle size. There is more work that is being done to reduce the size of deck.gl and we are confident that even as fture releases will have more functionality, we will be able to keep the library code from growing and, more importantly, make deck.gl even more "tree shakeable", with the intention that apps should only "pay for what they use".


## Remarks

* **Optmizing for minified code** - Due to inclusion of sourcemaps etc, the bundle size impact of deck.gl tends to look more significant in development builds than in the final production builds. While reducing the size of the development libraries is also desirable, the current goal is to ensure the impact of adding deck.gl on the final, minified/uglified application bundle is as small as possible.
