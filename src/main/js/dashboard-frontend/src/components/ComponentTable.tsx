/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {Component, ReactNode} from "react";
import {withRouter} from "react-router-dom";

import {
  Box,
  Button,
  Checkbox,
  Header,
  Link,
  Modal,
  SpaceBetween,
  StatusIndicator,
  Table
} from "@awsui/components-react";

import {ComponentItem} from "../util/ComponentItem";
import {SERVER} from "../index";
import {APICall} from "../util/CommUtils";
import {SERVICE_ROUTE_HREF_PREFIX, USER_CREATED} from "../util/constNames";
import {BoxProps} from "@awsui/components-react/box/interfaces";
import {TableProps} from "@awsui/components-react/table";

interface ServiceTableProps {
  title: string;
}

interface ServiceTableState {
  items: ComponentItem[];
  selectedItems: ComponentItem[];
  onlyShowUserComponents: boolean;
  tempShowUserComponents: boolean;
  preferencePaneVisible: boolean;
  sortingColumn?: TableProps.SortingColumn<any>;
  sortDescending: boolean;
}

/**
 * Custom view for GG component tables
 */
class ComponentTable extends Component<any & ServiceTableProps,
  ServiceTableState> {
  state: ServiceTableState = {
    items: [],
    selectedItems: [],
    onlyShowUserComponents: true,
    tempShowUserComponents: true,
    preferencePaneVisible: false,
    sortDescending: true,
  };

  columnDefinitions: TableProps.ColumnDefinition<ComponentItem>[] = [
    {
      id: "name",
      header: "Name",
      cell: (item: ComponentItem) => (
        <Link href={`${SERVICE_ROUTE_HREF_PREFIX}${item.name}`}>{item.name}</Link>
      ),
      sortingField: "name"
    },
    {
      id: "version",
      header: "Version",
      cell: (item: ComponentItem) => item.version,
      sortingField: "version"
    },
    {
      id: "status",
      header: "Status",
      cell: (item: ComponentItem) => (
        <Box color={`text-status-${item.statusIcon}` as BoxProps.Color}>
          <StatusIndicator type={item.statusIcon}/>
          {` ${item.status}`}
        </Box>
      ),
      sortingField: "status"
    },
    {
      id: "origin",
      header: "Origin",
      cell: (item: ComponentItem) => item.origin,
      sortingField: "origin"
    },
  ];

  emptyState: ReactNode = (
    <Box textAlign={"center"}>
      <Box padding={{top: "s"}} margin={{bottom: "xs"}}>
        <b>No components</b>
      </Box>
      <Box margin={{bottom: "s"}} variant={"p"}> No running components.</Box>
    </Box>
  );

  async componentDidMount() {
    await SERVER.initConnections();
    SERVER.sendSubscriptionMessage(
      {call: APICall.subscribeToComponentList, args: []},
      this.handleServerPush
    ).catch((reason) => {
      console.log("Error: " + reason);
    });
  }

  handleServerPush = (serviceList: ComponentItem[]) => {
    this.setState({items: serviceList});
  };

  onServiceSelectionChange(e: any) {
    this.setState({selectedItems: e.detail.selectedItems});
  }

  onStartService() {
    SERVER.sendRequest({
      call: APICall.startComponent,
      args: [this.state.selectedItems[0].name],
    });
  }

  onStopService() {
    SERVER.sendRequest({
      call: APICall.stopComponent,
      args: [this.state.selectedItems[0].name],
    });
  }

  onViewDetails() {
    let serviceName = this.state.selectedItems[0].name;
    this.props.history.push(
      `${SERVICE_ROUTE_HREF_PREFIX.substring(1)}${serviceName}`
    );
  }

  onToggleViewBuiltIns = (e: any) => {
    this.setState({tempShowUserComponents: e.detail.checked});
  };
  onConfirm = () => {
    this.setState(prevState => ({
      onlyShowUserComponents: prevState.tempShowUserComponents,
      preferencePaneVisible: false,
    }));
  };
  onCancel = () => {
    this.setState(prevState => ({
      tempShowUserComponents: prevState.onlyShowUserComponents,
      preferencePaneVisible: false,
    }));
  };

  render() {
    const sortingColumn = this.state.sortingColumn || this.columnDefinitions[0];
    let items = this.state.items.filter(
      (item) =>
        item.origin === USER_CREATED || !this.state.onlyShowUserComponents
      // @ts-ignore
    ).sort((a, b) => (this.state.sortDescending ? 1 : -1) * (a[sortingColumn.sortingField]).localeCompare(b[sortingColumn.sortingField]));
    return (
      <Table
        id="component-table"
        loadingText="Loading components"
        columnDefinitions={this.columnDefinitions}
        items={items}
        header={
          <Header
            variant={"h2"}
            counter={`(${items.length})`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  className="view-details"
                  disabled={this.state.selectedItems.length === 0}
                  onClick={this.onViewDetails.bind(this)}
                >
                  View details
                </Button>
                <Button
                  className="start"
                  onClick={this.onStartService.bind(this)}
                  disabled={
                    this.state.selectedItems.length === 0 ||
                    !this.state.selectedItems[0].canStart
                  }
                >
                  Start
                </Button>
                <Button
                  className="stop"
                  onClick={this.onStopService.bind(this)}
                  disabled={
                    this.state.selectedItems.length === 0 ||
                    !this.state.selectedItems[0].canStop
                  }
                >
                  Stop
                </Button>
              </SpaceBetween>
            }
          >
            {this.props.title}
          </Header>
        }
        selectedItems={this.state.selectedItems}
        empty={this.emptyState}
        sortingColumn={sortingColumn}
        onSortingChange={(e) => this.setState({
          sortingColumn: e.detail.sortingColumn,
          sortDescending: e.detail.isDescending!
        })}
        sortingDescending={this.state.sortDescending}
        selectionType={"single"}
        onSelectionChange={this.onServiceSelectionChange.bind(this)}
        preferences={
          <>
            <Button onClick={() => this.setState({preferencePaneVisible: true})}>Preferences</Button>
            <Modal
              onDismiss={this.onCancel.bind(this)}
              visible={this.state.preferencePaneVisible}
              size="medium"
              footer={
                <Box float="right">
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button variant="link" onClick={this.onCancel.bind(this)}>Cancel</Button>
                    <Button variant="primary" onClick={this.onConfirm.bind(this)}>Ok</Button>
                  </SpaceBetween>
                </Box>
              }
              header="Preferences"
            >
              <Checkbox
                className="user-created-checkbox"
                checked={this.state.tempShowUserComponents}
                onChange={this.onToggleViewBuiltIns}
              >
                Only show user-created components
              </Checkbox>
            </Modal>
          </>
        }
      />
    );
  }
}

export default withRouter(ComponentTable);
