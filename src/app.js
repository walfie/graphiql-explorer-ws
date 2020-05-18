import React from "react";
import ReactDOM from "react-dom";

import querystring from "querystring";
import GraphiQL from "graphiql";
import GraphiQLExplorer from "graphiql-explorer";
import { getIntrospectionQuery, buildClientSchema, parse } from "graphql";
import { SubscriptionClient } from "subscriptions-transport-ws";
import { graphQLFetcher as graphiQLSubscriptionsFetcher } from "graphiql-subscriptions-fetcher/dist/fetcher";

import "graphiql/graphiql.css";
import "./app.css";

function createFetcher({ url, wsUrl, wsProtocols }) {
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
const DEFAULT_QUERY = `# Welcome to GraphiQL
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
#     {
#       field(arg: "value") {
#         subField
#       }
#     }
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

function getParamsFromQueryString() {
  return querystring.decode(window.location.search.substr(1));
}

class ExternalState {
  constructor(prefix) {
    this.prefix = prefix || "graphiql";
  }

  get(key) {
    const queryParams = getParamsFromQueryString();

    return (
      queryParams[key] ||
      (window.localStorage &&
        window.localStorage.getItem(`${this.prefix}:${key}`)) ||
      null
    );
  }

  set(key, value) {
    const queryParams = getParamsFromQueryString();
    queryParams[key] = value;

    window.history.replaceState(
      null,
      null,
      "?" + querystring.encode(queryParams)
    );

    window.localStorage &&
      window.localStorage.setItem(`${this.prefix}:${key}`, value);
  }
}

class App extends React.Component {
  externalState = this.props.externalState || new ExternalState();
  // Priority order of the query/variables that show up on opening the page:
  // - query from query string (if set)
  // - query stored in localStorage (which graphiql sets when closing window)
  // - default empty query

  state = {
    schema: null,
    query:
      this.externalState.get("query") ||
      this.props.defaultQuery ||
      DEFAULT_QUERY,
    variables:
      this.externalState.get("variables") ||
      this.props.defaultVariables ||
      null,
    explorerIsOpen: this.externalState.get("explorerIsOpen") !== "false",
  };

  componentDidMount() {
    this.props.fetcher({ query: getIntrospectionQuery() }).then((result) => {
      const newState = { schema: buildClientSchema(result.data) };

      if (this.state.query === null) {
        newState.query = DEFAULT_QUERY;
      }

      this.setState(newState);
    });

    const editor = this._graphiql.getQueryEditor();
    editor.setOption("extraKeys", {
      ...(editor.options.extraKeys || {}),
      "Shift-Alt-LeftClick": this.handleInspectOperation,
    });
  }

  handleInspectOperation = (cm, mousePos) => {
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

  onEditQuery = (query) => {
    this.externalState.set("query", query);
    this.setState({ query });
  };

  toggleExplorer = () => {
    const explorerIsOpen = !this.state.explorerIsOpen;
    this.externalState.set("explorerIsOpen", explorerIsOpen);
    this.setState({ explorerIsOpen });
  };

  onEditOperationName = (operationName) => {
    this.externalState.set("operationName", operationName);
  };

  onEditVariables = (variables) => {
    this.externalState.set("variables", variables);
  };

  render() {
    const { query, variables, schema } = this.state;

    return (
      <React.Fragment>
        <GraphiQLExplorer
          schema={schema}
          query={query}
          onEdit={this.onEditQuery}
          explorerIsOpen={this.state.explorerIsOpen}
          onToggleExplorer={this.toggleExplorer}
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
          onEditQuery={this.onEditQuery}
          onEditVariables={this.onEditVariables}
          onEditOperationName={this.onEditOperationName}
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
              onClick={this.toggleExplorer}
              label="Explorer"
              title="Toggle Explorer"
            />
          </GraphiQL.Toolbar>
        </GraphiQL>
      </React.Fragment>
    );
  }
}

function render({ fetcher, defaultQuery, defaultVariables }, elem) {
  const app = (
    <App
      fetcher={fetcher}
      defaultQuery={defaultQuery}
      defaultVariables={defaultVariables}
    />
  );

  ReactDOM.render(app, elem);
}

export { createFetcher, App, ExternalState, render };
