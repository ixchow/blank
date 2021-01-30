# Blank

Blank ("_") is a very simple templating language meant for use in server-side generation of web pages. Blank works by translating loaded template files into javascript code using a simple set of quoting rules and then running them with a restricted set of global variables.

## Template Format

In a Blank template (generally a `._` file), everything between `%{` and `}%` is run as javascript code [in a restricted environment], while everything outside is output directly.

More concretely, `}% text text ... %{` is replaced with `write(" text text ... ");` -- properly quoting characters inside the `"` -- then the file is run.
(A similar replacement is done for everything between the start of the file and the first `%{`, and between the last `}%` and the end of the file.)

*But what about a literal `%{` or `}%`*?
Blank prioritizes simplicity over perfection.
So you'll need to work around it yourself. Maybe use an html entity or javascript code that `write`s the characters?

## Execution Context

Generally, templates execute in a restricted environment with access to only the standard javscript globals and two special functions:
 - `include(filename, context={})` which can be used to include templates recursively; `context` is merged with the context of the current template.
 - `write(str)` outputs its argument.

`include` is provided by blank if your code doesn't supply it when processing a template.
`write` *must* be supplied by your code.

## Programmatic Usage

Blank exports two functions, both of which run a template with a provided context.
Your code must (at least) provide a `write` function int the context.

The `blank.includeSync(filename, context)` function works synchronously, while the `blank.include(filename, context, callback)` function works asyncronously.

## Command-line Usage
You can call `node blank.js <infile> <outfile>` from the command line to process files.
This assumes utf8 encoding of both the input and output.
When run from the command line, blank templates recieve a context that also includes node's `require` function.

## A Note On Security
**Blank is only intended for templates you trust.**
No attempt has been made to make blank secure against malicious templates; indeed, such security is in general impossible (e.g., your code can never know if a user is trying to steal all of the cycles or has just written bad code).
