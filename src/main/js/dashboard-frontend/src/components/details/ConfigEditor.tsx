/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import AceEditor from "react-ace";

import "ace-builds/src-noconflict/mode-yaml";
import "ace-builds/src-noconflict/theme-twilight";
import "ace-builds/src-noconflict/theme-iplastic";
import {SERVER} from "../../index";
import {APICall, ConfigMessage} from "../../util/CommUtils";
import {
  Button,
  Container,
  Flashbar,
  FlashbarProps,
  Header,
  Spinner,
} from "@cloudscape-design/components";
import generateUniqueId from "../../util/generateUniqueId";

interface ConfigEditorProps {
  dark: boolean;
  service: string;
}
interface ConfigEditorState {
  allowEdit: boolean;
  saving: boolean;
  value: string;
  flashItems: FlashbarProps.MessageDefinition[];
}
export class ConfigEditor extends React.Component<
  ConfigEditorProps,
  ConfigEditorState
> {
  state = {
    allowEdit: false,
    saving: false,
    value: "",
    flashItems: [] as FlashbarProps.MessageDefinition[],
  };

  onChange(newValue: string) {
    this.setState({ value: newValue });
  }
  onSave = () => {
    this.setState({ saving: true });
    SERVER.sendRequest({
      call: APICall.updateConfig,
      args: [this.props.service, this.state.value],
    })
      .then((retval: ConfigMessage) => {
        if (retval.successful) {
          this.updateFlashbar(true);
        } else {
          this.updateFlashbar(false, retval.errorMsg);
        }
        this.setState({ saving: false });
      })
      .catch((reason) => {
        console.log("Error: " + reason);
        this.setState({ saving: false });
        this.updateFlashbar(false, reason);
      });
  };
  removeItem = (id: string) => {
    this.setState(prevState => ({
      flashItems: prevState.flashItems.filter((item) => {
        return item.id !== id;
      })
    }));
  };

  updateFlashbar = (success: boolean, errorMsg?: string) => {
    const itemID = generateUniqueId();
    if (success) {
      this.setState(prevState => ({
        flashItems:
          prevState.flashItems.concat([
            {
              id: itemID,
              type: "success",
              content: "Config updated successfully.",
              dismissible: true,
              onDismiss: () => this.removeItem(itemID),
            },
          ]),
      }));
    } else {
      this.setState(prevState => ({
        flashItems:
          prevState.flashItems.concat([
            {
              id: itemID,
              type: "error",
              content: `Unable to update config. ${errorMsg}`,
              dismissible: true,
              onDismiss: () => this.removeItem(itemID),
            },
          ]),
      }));
    }
  };

  async componentDidUpdate(
    prevProps: Readonly<ConfigEditorProps>,
    prevState: Readonly<ConfigEditorState>,
    snapshot?: any
  ) {
    if (prevProps.service !== this.props.service) {
      // update looked-at service
      SERVER.sendRequest({
        call: APICall.getComponent,
        args: [this.props.service],
      })
        .then((component) =>
          SERVER.sendRequest({
            call: APICall.getConfig,
            args: [component.name],
          })
        )
        .then((config: ConfigMessage) => {
          if (config.successful) {
            this.setState({ value: config.yaml });
          } else {
            this.updateFlashbar(false, config.errorMsg);
          }
        })
        .catch((reason) => {
          console.log("Error: " + reason);
          this.updateFlashbar(false, reason);
        });
    }
  }
  async componentDidMount() {
    await SERVER.initConnections();
    SERVER.sendRequest({
      call: APICall.getComponent,
      args: [this.props.service],
    })
      .then((component) =>
        SERVER.sendRequest({ call: APICall.getConfig, args: [component.name] })
      )
      .then((config) => {
        if (config.successful) {
          this.setState({ value: config.yaml });
          this.setState({ allowEdit: true });
        } else {
          this.updateFlashbar(false, config.errorMsg);
        }
      })
      .catch((reason) => {
        console.log("Error: " + reason);
        this.updateFlashbar(false, reason);
      });
  }

  render() {
    return (
      <Container
        header={
          <Header
            description={"View or edit the running configuration in YAML"}
            variant={"h2"}
            actions={
              <>
                <Button
                  variant="primary"
                  onClick={this.onSave}
                  disabled={!this.state.allowEdit || this.state.saving}
                >
                  {this.state.saving ? (
                    <>
                      <Spinner /> Save
                    </>
                  ) : (
                    <>Save</>
                  )}
                </Button>
              </>
            }
          >
            Running config
          </Header>
        }
      >
        <Flashbar items={this.state.flashItems} />
        <AceEditor
          mode="yaml"
          theme={this.props.dark ? "twilight" : "iplastic"}
          value={this.state.value}
          onChange={this.onChange.bind(this)}
          fontSize={14}
          showPrintMargin={this.state.allowEdit}
          showGutter={this.state.allowEdit}
          highlightActiveLine={this.state.allowEdit}
          width="100%"
          height="400px"
          setOptions={{
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: false,
            showLineNumbers: true,
            tabSize: 2,
            useSoftTabs: true,
          }}
          readOnly={!this.state.allowEdit}
        />
      </Container>
    );
  }
}
