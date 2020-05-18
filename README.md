# graphiql-explorer-ws

This repo's history was extracted from the [gatsby-graphiql-explorer] package
in [gatsby-js/gatsby].

The intent is to add support for [subscriptions-transport-ws], and for
the js entrypoint to be configurable for use-cases outside of gatsby
(for the script to be included and initialized manually in standalone `index.html` files).

[gatsby-graphiql-explorer]: https://github.com/gatsbyjs/gatsby/tree/master/packages/gatsby-graphiql-explorer
[gatsby-js/gatsby]: https://github.com/gatsbyjs/gatsby
[subscriptions-transport-ws]: https://github.com/apollographql/subscriptions-transport-ws

## Example

There is [an example `index.html` page on unpkg](https://unpkg.com/@walfie/graphiql-explorer-ws/dist/index.html)
pointing to the [graphql-pokemon API](https://github.com/lucasbento/graphql-pokemon).

Unfortunately I can't find a convenient demo API to use for websockets, so it
only demonstrates regular queries.

## Usage

Include the script and CSS in your HTML, then create a `fetcher` and call `render`:

```html
<div id="root" class="graphiql-container">Loading...</div>

<script src="https://unpkg.com/@walfie/graphiql-explorer-ws@0.5.0/dist/graphiql-explorer-ws.js"></script>
<link
  rel="stylesheet"
  href="https://unpkg.com/@walfie/graphiql-explorer-ws@0.5.0/dist/styles.css"
/>

<script>
  const fetcher = GraphiQLExplorerWs.createFetcher({
    url: "https://example.com/graphql",
    wsUrl: "ws://example.com/graphql", // Optional
    wsProtocols: ["graphql-ws"], // Optional
  });
  GraphiQLExplorerWs.render({ fetcher }, document.getElementById("root"));
</script>
```

## Development

- Install dependencies

  ```
  npm install
  ```

- Run the development server

  ```
  npm run dev
  ```

- View the GraphiQL UI on <http://localhost:8080>.
