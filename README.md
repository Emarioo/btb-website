**WARNING:** Website is under construction.

This directory contains the source code for the website which you can find here [btb-lang.org](http://btb-lang.org).

The website refers to documentation in `https://github.com/Emarioo/BetterThanBatch/docs/guide`.

## Hosting website locally
You can host the website locally if you like to look at documentation for a specific BTB version and don't want to clone the repo and view the docs "by hand".

Follow these steps:
- nocheckin TODO: **THIS DOES NOT WORK, IT NEEDS UPDATING!!**
- Clone the repo or download the files in on github in the directory `src/webbtb`.
- Navigate to `src/webbtb` in the cloned repo or where you put the downloaded files.
- In a terminal, run `node server`. You need to install **NodeJS** (latest should be fine).
- The server will tell you which port the webserver is running on. You can access the website at this address [http://localhost:8080](http://localhost:8080).

If you are experiencing problems, please let me know through a github issue.

**TODO:** Move website design into other file.
# Website design
These are the goals:
- **Easy to find information** - Search feature, information ordererd by usefulness?
- **Fast website** - Clicking and navigating needs to be fast.
- **No frameworks** - We keep things simple, no unnecessary features, easy to maintain. Designing the website might take more time without frameworks since we will have to implement markdown-to-html conversion ourselves and the search feature. *But* I am kind of excited to implement it so I don't mind spending time on that, also i'd rather implement it myself than learning a framework (at least for this website right now).
- **Easy to edit documentation** - We write markdown files which the server converts to html. Therefore no duplication where website documentation in html is out of date with the markdown files in `docs`. We also let the server organize the documentation somewhat automatically without having to modify html (the server searches for all markdown files and makes them available instead of a developer having to add the new markdown file as a link in an html file).
- **No wierd mouse/web quirks** - Disable context menu (right click), it's in the way sometimes. Disable drag feature of selected text, it makes you drag text instead of reselecting different text close to previous text, super annoying.

## The layout
### Homepage
The homepage has a logo, code examples, and link to github releases.

Maybe some header text for the lastest version of the compiler?

A section to a "Get started page".

Further down we have some text explaining the project and some of the key features in the language.

**TODO:** Provide link to repository on the website (link to repo and github releases).
**TODO:** Deal with http and https. If directory security or ssl-keys exists then start https and http when launching server, otherwise just launch http.

### The guide
Search bar
An ordered list of information from `docs/guide`

Clicking on code snippets to copy. Small tiny code pieces like paths should be copied by just clicking on them (right?). Code blocks should have a button to the top right which copies text.

Should parsed markdown code blocks scretch over the whole screen even if the code inside isn't that big? Probably not. width auto doesn't work, maybe it's caused by \<code\>?

**TODO:** CSS for the website and markdown content. The current is garbage.
