/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as WebSocket from "ws";
import {
  APICall,
  InternalAPICall,
  Message,
  MessageType,
  PackedRequest,
} from "../../util/CommUtils";
import {
  forcePushList,
  forcePushSerializedGraph,
  mockComponentList,
  multipleComponentUpdates,
} from "./mockedData";

export class MockServer {
  server: WebSocket.Server;
  portno: number;

  //@ts-ignore
  connection: WebSocket;

  constructor(portno: number) {
    this.portno = portno;
    this.server = new WebSocket.Server({ host: "localhost", port: portno });
    this.server.on("connection", (conn: WebSocket) => {
      conn.on("message", (message: string) => {
        let packedRequest: PackedRequest = JSON.parse(message);
        console.log(packedRequest.request.call);
        if (packedRequest.request.call === "init") {
          this.connection = conn;
          conn.send(
            JSON.stringify({
              messageType: MessageType.RESPONSE,
              requestID: packedRequest.requestID,
              payload: null,
            })
          );
        } else this.handleMessage(conn, packedRequest);
      });
    });
  }

  handleMessage(conn: WebSocket, packedRequest: PackedRequest) {
    console.log("Handle: " + packedRequest.request.call);
    switch (packedRequest.request.call) {
      case APICall.subscribeToComponent: {
        this.sendMultipleComponentUpdates();
        break;
      }
      case InternalAPICall.forcePushComponentList: {
        this.forcePushComponentList();
        break;
      }
      case InternalAPICall.forcePushDependencyGraph: {
        this.forcePushDependencyGraph();
        break;
      }
      case APICall.subscribeToComponentLogs: {
        this.sendComponentLogUpdates(packedRequest.request.args[0]);
      }
    }
    conn.send(
      JSON.stringify({
        messageType: MessageType.RESPONSE,
        requestID: packedRequest.requestID,
        payload: true,
      })
    );
  }

  forcePushComponentList() {
    let message: Message = {
      messageType: MessageType.COMPONENT_LIST,
      requestID: -1,
      payload: forcePushList,
    };
    this.connection.send(JSON.stringify(message));
  }

  forcePushDependencyGraph() {
    let message: Message = {
      messageType: MessageType.DEPS_GRAPH,
      requestID: -1,
      payload: forcePushSerializedGraph,
    };
    this.connection.send(JSON.stringify(message));
  }

  sendListUpdate() {
    let message: Message = {
      messageType: MessageType.COMPONENT_LIST,
      requestID: -1,
      payload: mockComponentList,
    };
    this.connection.send(JSON.stringify(message));
  }

  sendMultipleComponentUpdates() {
    setTimeout(
      () =>
        this.connection.send(
          JSON.stringify({
            messageType: MessageType.COMPONENT_CHANGE,
            requestID: -1,
            payload: multipleComponentUpdates[0],
          })
        ),
      0
    );
    setTimeout(
      () =>
        this.connection.send(
          JSON.stringify({
            messageType: MessageType.COMPONENT_CHANGE,
            requestID: -1,
            payload: multipleComponentUpdates[1],
          })
        ),
      100
    );
    setTimeout(
      () =>
        this.connection.send(
          JSON.stringify({
            messageType: MessageType.COMPONENT_CHANGE,
            requestID: -1,
            payload: multipleComponentUpdates[2],
          })
        ),
      105
    );
  }

  // TODO: send log-like data
  sendComponentLogUpdates(name: string) {
    switch (name) {
      case "test1": {
        break;
      }
      case "test2": {
        break;
      }
      case "test3": {
        break;
      }
    }
  }
}
