/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, createRef } from "react";
import { withRouter } from "react-router-dom";

import { Container, Header } from "@awsui/components-react";
import * as d3 from "d3";
import dagreD3 from "dagre-d3";
import { ComponentItem } from "../../util/ComponentItem";
import { APICall, Dependency } from "../../util/CommUtils";
import {
  ALL_DEP_GRAPH_NODES,
  SERVICE_ROUTE_HREF_PREFIX,
} from "../../util/constNames";

import "../../styles/dependency-graph.scss";
import { SERVER } from "../../index";

interface DependencyGraphProps {
  rootComponent: string;
}
interface DependencyGraphState {
  services: Set<string>;
}
class DependencyGraph extends Component<
  any & DependencyGraphProps,
  DependencyGraphState
> {
  g: dagreD3.graphlib.Graph;
  d3render: dagreD3.Render;
  svg = createRef<SVGSVGElement>();
  innerG = createRef<SVGSVGElement>();
  cachedGraph: Map<string, Dependency[]> = new Map();

  state = {
    services: new Set<string>(),
  };

  constructor(props: any) {
    super(props);
    this.g = new dagreD3.graphlib.Graph({ compound: true })
      .setGraph({})
      .setDefaultEdgeLabel(function () {
        return {};
      });
    this.d3render = new dagreD3.render();
  }

  updateComponentDetails(list: ComponentItem[]) {
    let shouldRender = false;
    list.forEach((item) => {
      if (this.state.services.has(item.name)) {
        shouldRender = true;
        this.g.setNode(item.name, {
          labelType: "html",
          label: `<a href="${SERVICE_ROUTE_HREF_PREFIX}${item.name}" class="graphLink">${item.name}</a>: ${item.status}`,
          class: item.statusIcon,
        });
      }
    });
    if (shouldRender) {
      this.g.nodes().forEach((v) => {
        let node = this.g.node(v);
        // Round the corners of the nodes
        node.rx = node.ry = 5;
      });
      this.drawGraph();
    }
  }

  /**
   * Occasionally we will need to update the dependency structure itself, e.g. when a deployment is made.
   * We assume the graph is a tree, but the function can also handle cases where there is some sort of cycle.
   */
  updateTreeStructure(graph: Map<string, Dependency[]>) {
    this.cachedGraph = graph;
    this.g.nodes().forEach((node) => this.g.removeNode(node));
    let touched = new Set<string>();
    let roots: string[];
    if (this.props.rootComponent === ALL_DEP_GRAPH_NODES) {
      roots = Array.from(graph.keys());
    } else {
      roots = [this.props.rootComponent];
    }
    roots.forEach((rootComponent) => {
      if (touched.has(rootComponent)) {
        return;
      }
      let children = graph.get(rootComponent);
      if (children === undefined) {
        //TODO: what if something strange happens?
        console.log(`Oops, dep graph children of ${rootComponent} undefined`);
      } else {
        this.g.setNode(rootComponent, {
          label: rootComponent,
        });
        touched.add(rootComponent);
        this.dfs(rootComponent, touched, graph);
      }
    });
    this.setState({ services: new Set(touched) });
    SERVER.sendRequest({
      call: APICall.getComponentList,
      args: [],
    }).then((response) => this.updateComponentDetails(response));
  }
  dfs(node: string, touched: Set<string>, graph: Map<string, Dependency[]>) {
    let children = graph.get(node);
    if (children !== undefined) {
      children.forEach((child) => {
        if (!touched.has(child.name)) {
          touched.add(child.name);
          this.g.setNode(child.name, { label: child });
          this.dfs(child.name, touched, graph);
        }
        child.hard
          ? this.g.setEdge(node, child.name)
          : this.g.setEdge(node, child.name, {
              style: "stroke-dasharray: 5, 5; fill: none"
            });
      });
    }
  }

  drawGraph() {
    let svg = d3.select(this.svg.current);
    let inner: any = d3.select(this.innerG.current);
    this.d3render(inner, this.g);
    inner.attr("transform", `translate(20, 20)`);
    svg.attr("height", this.g.graph().height + 40);
    svg.attr("width", this.g.graph().width + 40);
  }
  async componentDidMount() {
    await SERVER.initConnections();
    SERVER.sendSubscriptionMessage(
      { call: APICall.subscribeToComponentList, args: [] },
      this.updateComponentDetails.bind(this)
    ).catch((reason) => {
      console.log("Error: " + reason);
    });
    SERVER.sendSubscriptionMessage(
      { call: APICall.subscribeToDependencyGraph, args: [] },
      this.updateTreeStructure.bind(this)
    ).catch((reason) => {
      console.log("Error: " + reason);
    });
  }

  componentDidUpdate(
    prevProps: Readonly<any>,
    prevState: Readonly<DependencyGraphState>,
    snapshot?: any
  ) {
    if (prevProps.rootComponent !== this.props.rootComponent) {
      this.updateTreeStructure(this.cachedGraph);
    }
  }

  render() {
    return (
      <Container
        header={<Header variant={"h2"}>Dependency Graph</Header>}
        disableContentPaddings={true}
      >
        <div className="holder">
          <svg width="100" height="100" ref={this.svg}>
            <g ref={this.innerG} />
          </svg>
        </div>
      </Container>
    );
  }
}

export default withRouter(DependencyGraph);
