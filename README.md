# Schedule-Creator That Can Read Your Timezone And Show them Accordingly

Inspired by GDQ's event page, which is always automatically set to the viewer's timezone. It's great. As someone who don't live in the United Staes, and therefore knows that timezones exist with as the same ease as knowing that the sun rises in the east, it's super useful. 

This is made for fun/educational purpose within three days. It implements the following: 

- [Lit-html](https://lit-html.polymer-project.org), the small templating library
- [Moment](https://momentjs.com), the extremely good time library, like dang, it has featuers I didn't even know I needed, but I *needed*
- [Eno Language](https://eno-lang.org), which is the best human-readable plain text format I've come across!
- [Rollup](https://rollupjs.org), which is muuuuch easier to use than Webpack
- Async/Await, which is supported by nearly every browser now apparently, but that does mean it won't work on IE/weird browsers.
- [Barebones](https://acahir.github.io/Barebones/) for the minimal styling.

## How it works
It's entirely front-end. Schedule is written in an eno file that'll be `fetch`ed by the browser on page load.

The eno file will be parsed, and then the events in it will be resplit into days according to the browser's timezone. We'll then use that to fill in the template.

Lit-HTML will render that template onto the DOM.

Yeah, that's it.

## Live Demo
[This repo's a GitHub page](https://pseudomon.github.io/scheduler/index.html)!

## Things I didn't implement
I should definitely implement a way to check if the data and format of the schedule in the eno file is correct. I just haven't bothered to do that yet.

Lit-html recommends minification and such to boost efficiency. As this is just a practice run, I didn't bother.

## npm start?
In my stubborn insistence on not using JavaScript for backend things, I use Python to serve the page locally during development. So that's why there's `start python -m http.server` in `package.json`.

