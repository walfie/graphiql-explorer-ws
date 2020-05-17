import React from "react";
import ReactDOM from "react-dom";

import querystring from "querystring";
import GraphiQL from "graphiql";
import GraphiQLExplorer from "graphiql-explorer";
import { getIntrospectionQuery, buildClientSchema, parse } from "graphql";
import { SubscriptionClient } from "subscriptions-transport-ws";
import { graphQLFetcher as graphiQLSubscriptionsFetcher } from "graphiql-subscriptions-fetcher/dist/fetcher";

import "whatwg-fetch";

import "graphiql/graphiql.css";
import "./app.css";

const parameters = querystring.decode(window.location.search.substr(1));

function fetcher({ url, wsUrl, wsProtocols }) {
  const defaultFetcher = (params) => {
    return fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    })
      .then((response) => response.json())
      .catch(() => response.text());
  };

  if (wsUrl) {
    let subscriptionsClient = new SubscriptionClient(
      wsUrl,
      { reconnect: true },
      undefined,
      wsProtocols
    );

    return graphiQLSubscriptionsFetcher(subscriptionsClient, defaultFetcher);
  } else {
    return defaultFetcher;
  }
}

// When the query and variables string is edited, update the URL bar so
// that it can be easily shared.
function onEditVariables(newVariables) {
  parameters.variables = newVariables;
  updateQueryString(parameters);
}
function onEditOperationName(newOperationName) {
  parameters.operationName = newOperationName;
  updateQueryString(parameters);
}

function updateQueryString(params) {
  window.history.replaceState(null, null, "?" + querystring.encode(params));
}

// We control query, so we need to recreate initial query text that show up
// on visiting graphiql - in order it will be
//  - query from query string (if set)
//  - query stored in localStorage (which graphiql set when closing window)
//  - default empty query
const DEFAULT_QUERY =
  parameters.query ||
  (window.localStorage && window.localStorage.getItem("graphiql:query")) ||
  null;

const DEFAULT_VARIABLES =
  parameters.variables ||
  (window.localStorage && window.localStorage.getItem("graphiql:variables")) ||
  null;

const QUERY_EXAMPLE_SITEMETADATA_TITLE = `#     {
#       site {
#         siteMetadata {
#           title
#         }
#       }
#     }`;

const QUERY_EXAMPLE_FALLBACK = `#     {
#       allSitePage {
#         nodes {
#           path
#         }
#       }
#     }`;

function generateDefaultFallbackQuery(queryExample) {
  return `# Welcome to GraphiQL
#
# GraphiQL is an in-browser tool for writing, validating, and
# testing GraphQL queries.
#
# Type queries into this side of the screen, and you will see intelligent
# typeaheads aware of the current GraphQL type schema and live syntax and
# validation errors highlighted within the text.
#
# GraphQL queries typically start with a "{" character. Lines that starts
# with a # are ignored.
#
# An example GraphQL query might look like:
#
${queryExample}
#
# Keyboard shortcuts:
#
#  Prettify Query:  Shift-Ctrl-P (or press the prettify button above)
#
#     Merge Query:  Shift-Ctrl-M (or press the merge button above)
#
#       Run Query:  Ctrl-Enter (or press the play button above)
#
#   Auto Complete:  Ctrl-Space (or just start typing)
#
`;
}

const storedExplorerPaneState =
  typeof parameters.explorerIsOpen !== "undefined"
    ? parameters.explorerIsOpen === "false"
      ? false
      : true
    : window.localStorage
    ? window.localStorage.getItem("graphiql:graphiqlExplorerOpen") !== "false"
    : true;

class App extends React.Component {
  state = {
    schema: null,
    query: DEFAULT_QUERY,
    variables: DEFAULT_VARIABLES,
    explorerIsOpen: storedExplorerPaneState,
  };

  componentDidMount() {
    this.props
      .fetcher({
        query: getIntrospectionQuery(),
      })
      .then((result) => {
        const newState = { schema: buildClientSchema(result.data) };

        if (this.state.query === null) {
          try {
            const siteMetadataType = result.data.__schema.types.find(
              (type) =>
                type.name === "SiteSiteMetadata" && type.kind === "OBJECT"
            );
            if (siteMetadataType) {
              const titleField = siteMetadataType.fields.find(
                (field) =>
                  field.name === "title" &&
                  field.type &&
                  field.type.kind === "SCALAR" &&
                  field.type.name === "String"
              );

              if (titleField) {
                newState.query = generateDefaultFallbackQuery(
                  QUERY_EXAMPLE_SITEMETADATA_TITLE
                );
              }
            }
            // eslint-disable-next-line no-empty
          } catch {}
          if (!newState.query) {
            newState.query = generateDefaultFallbackQuery(
              QUERY_EXAMPLE_FALLBACK
            );
          }
        }

        this.setState(newState);
      });

    const editor = this._graphiql.getQueryEditor();
    editor.setOption("extraKeys", {
      ...(editor.options.extraKeys || {}),
      "Shift-Alt-LeftClick": this._handleInspectOperation,
    });
  }

  _handleInspectOperation = (cm, mousePos) => {
    const parsedQuery = parse(this.state.query || "");

    if (!parsedQuery) {
      console.error("Couldn't parse query document");
      return null;
    }

    const token = cm.getTokenAt(mousePos);
    const start = { line: mousePos.line, ch: token.start };
    const end = { line: mousePos.line, ch: token.end };
    const relevantMousePos = {
      start: cm.indexFromPos(start),
      end: cm.indexFromPos(end),
    };

    const position = relevantMousePos;

    const def = parsedQuery.definitions.find((definition) => {
      if (!definition.loc) {
        console.log("Missing location information for definition");
        return false;
      }

      const { start, end } = definition.loc;
      return start <= position.start && end >= position.end;
    });

    if (!def) {
      console.error(
        "Unable to find definition corresponding to mouse position"
      );
      return null;
    }

    const operationKind =
      def.kind === "OperationDefinition"
        ? def.operation
        : def.kind === "FragmentDefinition"
        ? "fragment"
        : "unknown";

    const operationName =
      def.kind === "OperationDefinition" && !!def.name
        ? def.name.value
        : def.kind === "FragmentDefinition" && !!def.name
        ? def.name.value
        : "unknown";

    const selector = `.graphiql-explorer-root #${operationKind}-${operationName}`;

    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView();
      return true;
    }

    return false;
  };

  _handleEditQuery = (query) => {
    parameters.query = query;
    updateQueryString(parameters);
    this.setState({ query });
  };

  _handleToggleExplorer = () => {
    const newExplorerIsOpen = !this.state.explorerIsOpen;
    if (window.localStorage) {
      window.localStorage.setItem(
        "graphiql:graphiqlExplorerOpen",
        newExplorerIsOpen
      );
    }
    parameters.explorerIsOpen = newExplorerIsOpen;
    updateQueryString(parameters);
    this.setState({ explorerIsOpen: newExplorerIsOpen });
  };

  render() {
    const { query, variables, schema } = this.state;

    return (
      <React.Fragment>
        <GraphiQLExplorer
          schema={schema}
          query={query}
          onEdit={this._handleEditQuery}
          explorerIsOpen={this.state.explorerIsOpen}
          onToggleExplorer={this._handleToggleExplorer}
          onRunOperation={(operationName) =>
            this._graphiql.handleRunQuery(operationName)
          }
        />
        <GraphiQL
          ref={(ref) => (this._graphiql = ref)}
          fetcher={this.props.fetcher}
          schema={schema}
          query={query}
          variables={variables}
          onEditQuery={this._handleEditQuery}
          onEditVariables={onEditVariables}
          onEditOperationName={onEditOperationName}
        >
          <GraphiQL.Toolbar>
            <GraphiQL.Button
              onClick={() => this._graphiql.handlePrettifyQuery()}
              label="Prettify"
              title="Prettify Query (Shift-Ctrl-P)"
            />
            <GraphiQL.Button
              onClick={() => this._graphiql.handleToggleHistory()}
              label="History"
              title="Show History"
            />
            <GraphiQL.Button
              onClick={this._handleToggleExplorer}
              label="Explorer"
              title="Toggle Explorer"
            />
          </GraphiQL.Toolbar>
        </GraphiQL>
      </React.Fragment>
    );
  }
}

// TODO: Configurable
const f = fetcher({
  url: "http://localhost:8080/graphql",
  wsUrl: "ws://localhost:8080/graphql",
  wsProtocols: ["graphql-ws"],
});

ReactDOM.render(<App fetcher={f} />, document.getElementById("root"));
