
import React, { useContext, useEffect, useState } from "react";
import {
    Box, 
    ColumnLayout, 
    Container, 
    SpaceBetween, 
    Header, 
    ContentLayout, 
    Tabs, Table, TableProps, TabsProps,
    CollectionPreferencesProps,
    Button, 
    CollectionPreferences, 
    TextFilter,
    Modal,
    Form,
    Textarea
} from "@cloudscape-design/components";
import { RouteComponentProps, useHistory, withRouter } from "react-router-dom";
import { Stream, Message, formatBytes, ResponseMessage, getElapsedTime } from "../util/StreamManager";
import { SERVER , DefaultContext} from "../index";
import { APICall } from "../util/CommUtils";
import { STREAM_MANAGER_ROUTE_HREF_PREFIX } from "../util/constNames";
import PaginationRendering from "../util/PaginationRendering";

interface StreamManagerProps extends RouteComponentProps {
}

const StreamDetail: React.FC<StreamManagerProps> = () => {

    const [messagesList, setMessagesList] = useState<Message[]>([])
    const [streamDetails, setStreamDetails] = useState<Stream>();
    const [messageCount, setMessageCount] = useState(0);
    const [currentPageIndex, setCurrentPageIndex] = useState(1)
    const [readMessagesRequest, setReadMessagesRequest] = useState(false);
    const [appendMessageRequest, setAppendMessageRequest] = useState(false);
    const [filteringText, setFilteringText] = useState("");
    const [viewAppendMessage, setViewAppendMessage] = useState(false);
    const [messageToAppend, setMessageToAppend] = useState("");
    const defaultContext = useContext(DefaultContext);
    let streamName = useHistory().location.pathname.substring(STREAM_MANAGER_ROUTE_HREF_PREFIX.length - 1);
    const columnDefinitionsMessages: TableProps.ColumnDefinition<Message>[] = [
            {
                id: "key",
                header: "key",
                cell: (e:Message) => e.sequenceNumber
            },
            {
                id: "sequenceNumber",
                header: "Sequence number",
                cell: (e:Message) => e.sequenceNumber
            },
            {
                id: "message",
                header: "Message",
                cell: (e:Message) => atob(e.payload?.toString() || '')
            },
            {
                id: "ingestTime",
                header: "Message ingested",
                cell: (e:Message) => new Intl.DateTimeFormat("en-US", {
                                        year: "numeric",
                                        month: "2-digit",
                                        day: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit",
                                    }).format(e.ingestTime||0)
            },
    ];
    
    let storedPreference = localStorage.getItem('streamDetailsPreferences');
    if (!storedPreference){
        storedPreference =  JSON.stringify({
            pageSize: 100,
            visibleContent: ["sequenceNumber", "message", "ingestTime"]
        })
    }
    const [preferences, setPreferences] = useState<CollectionPreferencesProps.Preferences>(JSON.parse(storedPreference));

    const items = [
        [
            {
                field: "Stream Segment Size",
                value: formatBytes(streamDetails?.definition.streamSegmentSize),
            },
            {
                field: "Max Size",
                value: formatBytes(streamDetails?.definition.maxSize),
            },
            {
                field: "Total size",
                value: formatBytes(streamDetails?.storageStatus.totalBytes),
            },
        ],
        [
            {
                field: "Persistence",
                value: (streamDetails?.definition.persistence === 0 ? "File":"Memory")
            },
            {
                field: "Strategy",
                value: (streamDetails?.definition.strategyOnFull === 0 ? "RejectNewData": "OverwriteOldestData"),
            },
            {
                field: "Flush on write",
                value: (streamDetails?.definition.flushOnWrite?'true':'false'),
            },
        ]
    ];

    function OnPageIndexChangedHanlder (pageIndex:number) {
        setCurrentPageIndex(pageIndex);
    }

    const onClickRefresh = () => {
        describeStream(streamName, 0);
    }

    const onClickAppend = () => {
        setViewAppendMessage(true);
    }

    const tabs: TabsProps.Tab[] = [
        {
            id: "tab1",
                label: "Details",
                content: (
                    <ColumnLayout key={"tab2"} columns={2} variant="text-grid">
                        {items.map((group, index) => (
                            <SpaceBetween size="xs" key={index}>
                                {group.map((item) => (
                                    <div key={item.field}>
                                        <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">{item.field}</Box>
                                        <div>{item.value}</div>
                                    </div>
                                ))}
                            </SpaceBetween>
                        ))}
                    </ColumnLayout>
                ),
        },
        {
            id: "tab2",
                label: "Export statuses",
                content: (
                    <ColumnLayout columns={streamDetails?.exportStatuses.length} variant="text-grid">
                        {streamDetails?.exportStatuses && streamDetails?.exportStatuses.map((group, index) => (
                            <SpaceBetween direction="horizontal" size="xxs" key={group.exportConfigIdentifier}>
                                <div key={index}>
                                    <SpaceBetween direction="vertical" size="xs" key={group.exportConfigIdentifier}>
                                        <div >
                                            <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Identifier</Box>
                                            <div>{group.exportConfigIdentifier}</div>
                                        </div>
                                        <div >
                                            <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Exported bytes</Box>
                                            <div>{formatBytes(group.exportedBytesFromStream)}</div>
                                        </div>
                                        <div >
                                            <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Exported messages</Box>
                                            <div>{group.exportedMessagesCount}</div>
                                        </div>
                                        <div>
                                            <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Last exported sequence number</Box>
                                            <div>{group.lastExportedSequenceNumber}</div>
                                        </div>
                                        <div >
                                            <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Last exported time</Box>
                                            <div>{new Intl.DateTimeFormat("en-US", {
                                                    year: "numeric",
                                                    month: "2-digit",
                                                    day: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    second: "2-digit",
                                                }).format(group.lastExportTime)} - {getElapsedTime(group.lastExportTime)}</div>
                                        </div>
                                        <div>
                                            <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Error Message</Box>
                                            <div>{group.errorMessage || 'None'}</div>
                                        </div>
                                    </SpaceBetween>
                                </div>
                            </SpaceBetween>
                        ))}
                        {   streamDetails?.definition.exportDefinition.kinesis.length === 0 && 
                            <div>No export status.</div>
                        }
                    </ColumnLayout>
            ),
        },
        {
            id: "tab3",
            label: "Export definition",
            content: (
                <Tabs tabs={[
                    {
                        id: "tab31",
                        content:(
                            <ColumnLayout columns={streamDetails?.exportStatuses.length} variant="text-grid">
                                {streamDetails?.definition.exportDefinition.kinesis.map((group, index) => (
                                    <SpaceBetween direction="horizontal" size="xxs" key={group.identifier}>
                                        <div key={index}>
                                            <SpaceBetween direction="vertical" size="xs" key={group.identifier}>
                                                <div >
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Identifier</Box>
                                                    <div>{group.identifier}</div>
                                                </div>
                                                <div >
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Kinesis stream</Box>
                                                    <div>{group.kinesisStreamName}</div>
                                                </div>
                                                <div >
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Batch size</Box>
                                                    <div>{group.batchSize?group.batchSize:'-'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Batch interval</Box>
                                                    <div>{group.batchIntervalMillis?group.batchIntervalMillis:'-'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Priority</Box>
                                                    <div>{group.priority?group.priority:'-'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Status</Box>
                                                    <div>{group.disabled === true?'true':'false'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Start sequence number</Box>
                                                    <div>{group.startSequenceNumber ? group.startSequenceNumber:'-'}</div>
                                                </div>
                                            </SpaceBetween>
                                        </div>
                                    </SpaceBetween>
                                ))}{streamDetails?.definition.exportDefinition.kinesis.length === 0 && 
                                    <div>No Kinesis export.</div>}
                            </ColumnLayout>
                        ),
                        label:"Kinesis"
                    },
                    {
                        id: "tab32",
                        content:(
                            <ColumnLayout columns={streamDetails?.exportStatuses.length} variant="text-grid">
                                {streamDetails?.definition.exportDefinition.IotSitewise && streamDetails?.definition.exportDefinition.IotSitewise.map((group, index) => (
                                    <SpaceBetween direction="horizontal" size="xxs" key={group.identifier}>
                                        <div key={index}>
                                            <SpaceBetween direction="vertical" size="xs" key={group.identifier}>
                                                <div >
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Identifier</Box>
                                                    <div>{group.identifier}</div>
                                                </div>
                                                <div >
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Batch size</Box>
                                                    <div>{group.batchSize?group.batchSize:'-'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Batch interval</Box>
                                                    <div>{group.batchIntervalMillis?group.batchIntervalMillis:'-'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}}variant="awsui-key-label" color="text-label">Priority</Box>
                                                    <div>{group.priority?group.priority:'-'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Status</Box>
                                                    <div>{group.disabled === true?'true':'false'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Start sequence number</Box>
                                                    <div>{group.startSequenceNumber ? group.startSequenceNumber:'-'}</div>
                                                </div>
                                            </SpaceBetween>
                                        </div>
                                    </SpaceBetween>
                                ))
                                }{
                                    streamDetails?.definition.exportDefinition.IotSitewise.length === 0 && 
                                    <div>No IoT Sitewise export.</div>
                                }
                            </ColumnLayout>
                        ),
                        label:"IoT Sitewise"
                    },
                    {
                        id: "tab33",
                        content:(
                            <ColumnLayout columns={streamDetails?.exportStatuses.length} variant="text-grid">
                                {streamDetails?.definition.exportDefinition.iotAnalytics.map((group, index) => (
                                    <SpaceBetween direction="horizontal" size="xxs" key={group.identifier}>
                                        <div key={index}>
                                            <SpaceBetween direction="vertical" size="xs" key={group.identifier}>
                                                <div >
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Identifier</Box>
                                                    <div>{group.identifier}</div>
                                                </div>
                                                <div >
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">IoT channel</Box>
                                                    <div>{group.iotChannel}</div>
                                                </div>
                                                <div >
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Id prefix</Box>
                                                    <div>{group.iotMsgIdPrefix}</div>
                                                </div>
                                                <div >
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Batch size</Box>
                                                    <div>{group.batchSize?group.batchSize:'-'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Batch interval</Box>
                                                    <div>{group.batchIntervalMillis?group.batchIntervalMillis:'-'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Priority</Box>
                                                    <div>{group.priority?group.priority:'-'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Status</Box>
                                                    <div>{group.disabled === true?'true':'false'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Start sequence number</Box>
                                                    <div>{group.startSequenceNumber ? group.startSequenceNumber:'-'}</div>
                                                </div>
                                            </SpaceBetween>
                                        </div>
                                    </SpaceBetween>
                                ))}{
                                    streamDetails?.definition.exportDefinition.iotAnalytics.length === 0 && 
                                    <div>No IoT Analytics export.</div>
                                }
                            </ColumnLayout>
                        ),
                        label:"IoT analytics"
                    },
                    {
                        id: "tab34",
                        content:(
                            <ColumnLayout columns={streamDetails?.exportStatuses.length} variant="text-grid">
                                {streamDetails?.definition.exportDefinition.http.map((group, index) => (
                                    <SpaceBetween direction="horizontal" size="xxs" key={group.identifier}>
                                        <div key={index}>
                                            <SpaceBetween direction="vertical" size="xs" key={group.identifier}>
                                                <div >
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Identifier</Box>
                                                    <div>{group.identifier}</div>
                                                </div>
                                                <div >
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">URI</Box>
                                                    <div>{group.uri}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Export format</Box>
                                                    <div>{group.exportFormat?'RAW NOT BATCHED':'JSON_BATCHED'}</div>
                                                </div>
                                                <div >
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Batch size</Box>
                                                    <div>{group.batchSize?group.batchSize:'-'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Batch interval</Box>
                                                    <div>{group.batchIntervalMillis?group.batchIntervalMillis:'-'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Priority</Box>
                                                    <div>{group.priority?group.priority:'-'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Status</Box>
                                                    <div>{group.disabled === true?'true':'false'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Start sequence number</Box>
                                                    <div>{group.startSequenceNumber ? group.startSequenceNumber:'-'}</div>
                                                </div>
                                            </SpaceBetween>
                                        </div>
                                    </SpaceBetween>
                                ))}{
                                    streamDetails?.definition.exportDefinition.http.length === 0 && 
                                    <div>No HTTP export.</div>
                                }
                            </ColumnLayout>
                        ),
                        label:"HTTP"
                    },
                    {
                        id: "tab35",
                        content:(
                            <ColumnLayout columns={streamDetails?.exportStatuses.length} variant="text-grid">
                                {streamDetails?.definition.exportDefinition.s3TaskExecutor.map((group, index) => (
                                    <SpaceBetween direction="horizontal" size="xxs" key={group.identifier}>
                                        <div key={index}>
                                            <SpaceBetween direction="vertical" size="xs" key={group.identifier}>
                                                <div >
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Identifier</Box>
                                                    <div>{group.identifier}</div>
                                                </div>
                                                <div >
                                                    <Box margin={{bottom: "xxxs"}}variant="awsui-key-label" color="text-label">Size threshold multipart Upload</Box>
                                                    <div>{formatBytes(group.sizeThresholdForMultipartUploadBytes)}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Status stream name</Box>
                                                    <div>{group.statusConfig.statusStreamName}</div>
                                                </div>
                                                <div >
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Status level</Box>
                                                    <div>{group.statusConfig.statusLevel}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Priority</Box>
                                                    <div>{group.priority?group.priority:'-'}</div>
                                                </div>
                                                <div>
                                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label" color="text-label">Status</Box>
                                                    <div>{group.disabled === true?'true':'false'}</div>
                                                </div>
                                            </SpaceBetween>
                                        </div>
                                    </SpaceBetween>
                                ))}{
                                    streamDetails?.definition.exportDefinition.s3TaskExecutor.length === 0 && 
                                    <div>No S3 export.</div>
                                }
                            </ColumnLayout>
                        ),
                        label:"S3"
                    }
                ]}></Tabs>
            ),
        },
    ];

    async function describeStream(streamName:string, index:number){
        SERVER.sendRequest({ call: APICall.streamManagerDescribeStream, args: [streamName] }).then(
            (response) => {
                if (response) {
                    const item:Stream = response;
                    console.log(item);
                    item.key = index;
                    setStreamDetails(item);
                    setMessageCount(item.storageStatus.newestSequenceNumber-item.storageStatus.oldestSequenceNumber + 1)
                    readMessages(streamName, item.storageStatus.newestSequenceNumber)
                }
            },
            (reason) => {
                console.log("Error in [StreamManager]: " + reason);
            }
        );
    }

    async function readMessages(streamName:string, desiredStartSequenceNumber:number){
        if (desiredStartSequenceNumber >= 0)
        {
            setMessagesList([]);
            setReadMessagesRequest(true);
            if (desiredStartSequenceNumber - (preferences.pageSize || 100)*(currentPageIndex-1) >= (preferences.pageSize || 100)){
                SERVER.sendRequest({ call: APICall.streamManagerReadMessages, args: [streamName, desiredStartSequenceNumber - (preferences.pageSize || 100)*(currentPageIndex) + 1, 1, (preferences.pageSize || 100), 5000] }).then(
                    (response:Message[]) => {
                        if (response) {
                            const listMessageDescending:any = response;
                            listMessageDescending.sort((a:any, b:any) => b.sequenceNumber - a.sequenceNumber);
                            setMessagesList(listMessageDescending);
                        }
                        setReadMessagesRequest(false);
                    },
                    (reason) => {
                        setReadMessagesRequest(false);
                        console.log("Error in [StreamManager]: " + reason);
                    }
                );
            }
            else{
                SERVER.sendRequest({ call: APICall.streamManagerReadMessages, args: [streamName, 0, 1, desiredStartSequenceNumber - (preferences.pageSize || 100)*(currentPageIndex-1) + 1, 5000] }).then(
                    (response) => {
                        if (response) {
                            const listMessageDescending = response.sort((a:any, b:any) => b.sequenceNumber - a.sequenceNumber);
                            setMessagesList(listMessageDescending);
                            setReadMessagesRequest(false);
                        }
                    },
                    (reason) => {
                        setReadMessagesRequest(false);
                        console.log("Error in [StreamManager]: " + reason);
                    }
                );
            }
        }
    }

    const onDismiss = () => {
        setViewAppendMessage(false);
        setMessageToAppend("");
    }

    const appendMessageClick = () => {
        setAppendMessageRequest(true);
        SERVER.sendRequest({ call: APICall.streamManagerAppendMessage, args: [streamName, messageToAppend] }).then(
            (response:ResponseMessage) => {
                if (response) {
                    setAppendMessageRequest(false);
                    defaultContext.addFlashItem!({
                        type: response.successful === true?'success':'error',
                        header: response.successful === true?'Message has been added to ' + streamName:'Failed to add the message to ' + streamName,
                        content: response.errorMsg
                    });
                    describeStream(streamName, 0);
                    setViewAppendMessage(false);
                }
            },
            (reason) => {
                console.log("Error in [StreamManager]: " + reason);
            }
        );
    }

    useEffect(() => {
        describeStream(streamName, 0);
    }, [currentPageIndex, preferences]);

    return (
        <ContentLayout key={"streamDetails"} header={<Header variant={"h1"}>{streamName}</Header>}>
            <SpaceBetween key={"SpaceBetweenStreamDetails"} direction="vertical"  size="l">
                <Container key={"Container"}>
                    <Tabs tabs={tabs}></Tabs>
                </Container>
                <Table
                        key={"messageTable"}
                        empty={
                            <Box textAlign="center" color="inherit">
                                <b>No messages</b>
                                <Box
                                    padding={{ bottom: "s" }}
                                    variant="p"
                                    color="inherit"
                                >
                                    No message to display.
                                </Box>
                            </Box>
                        }
                        trackBy="key"
                        loading={false}
                        wrapLines={true}
                        loadingText="Loading resources"
                        items={messagesList.filter((m:Message) => atob(m.payload?.toString() || '').includes(filteringText.toLowerCase()))}
                        filter={
                            <TextFilter
                                key={"findMessageTextFilter"}
                                filteringPlaceholder="Find message(s)"
                                filteringText={filteringText}
                                onChange={({detail}) =>setFilteringText(detail.filteringText)}
                            />
                        }
                        columnDefinitions={columnDefinitionsMessages}
                        visibleColumns={preferences.visibleContent}
                        preferences={
                            <CollectionPreferences
                                key={"CollectionPreferences"}
                                visibleContentPreference={{
                                    title: "Visible columns",
                                    options: [{
                                        label: "", options: [
                                            {editable: false, label: "sequenceNumber", id: "sequenceNumber"},
                                            {editable: true, label: "message", id: "message"},
                                            {editable: true, label: "ingestTime", id: "ingestTime"},
                                        ]
                                    }]
                                }}
                                pageSizePreference={{
                                    title: "Page size",
                                    options: [
                                        {value: 10, label: "10"},
                                        {value: 50, label: "50"},
                                        {value: 100, label: "100"}]
                                }}
                                title={"Preferences"}
                                confirmLabel={"Ok"}
                                cancelLabel={"Cancel"}
                                preferences={preferences}
                                onConfirm={({detail}) => {setPreferences(detail);localStorage.setItem("streamDetailsPreferences", JSON.stringify(detail))}}
                            />
                        }
                    header={
                        <Header
                            key={"counterHeader"}
                            counter=
                            {
                                "(" + messageCount  +")"
                            }

                        actions={            
                            <SpaceBetween key={"SpaceBetween1"} direction="horizontal"  size="xs">
                                <Button     
                                    ariaDescribedby={"refresh"}
                                    ariaLabel="Refresh" 
                                    key={"Refresh"}
                                    onClick = {() => {
                                        onClickRefresh();
                                    }}
                                    iconName="refresh" 
                                    wrapText={false}
                                    disabled={readMessagesRequest}
                                >
                                    Refresh
                                </Button>
                                <Button     
                                    ariaDescribedby={"Add message"}
                                    ariaLabel="Add message" 
                                    key={"Append"}
                                    onClick = {() => {
                                        onClickAppend();
                                    }}
                                    iconName="add-plus"
                                    wrapText={false}
                                    disabled={appendMessageRequest}
                                >
                                    Add Message
                                </Button>
                                <Modal
                                    key={"ModalAppendMessage"}
                                    onDismiss={onDismiss}
                                    visible={viewAppendMessage}
                                    size="medium"
                                    footer={
                                        <Box key={"1"} float="right">
                                        <SpaceBetween key={"SpaceBetween2"} direction="horizontal" size="xs">
                                            <Button 
                                                variant="link" 
                                                onClick={onDismiss}
                                                ariaDescribedby={"Cancel"}
                                                ariaLabel="Cancel" 
                                            >
                                                Cancel
                                            </Button>
                                            <Button variant="primary" 
                                                onClick={appendMessageClick}
                                                ariaDescribedby={"Add"}
                                                ariaLabel="Add"
                                            >
                                                Add
                                            </Button>
                                        </SpaceBetween>
                                        </Box>
                                    }
                                    header={'Add message to '+streamName}
                                    >
                                        <Form
                                            key={"FormAddMessage"}
                                            variant="embedded"
                                            header={<Header variant="h1"></Header>}
                                        >
                                            <Textarea
                                                key={"TextareaAddMessage"}
                                                onChange={({ detail }) => { setMessageToAppend(detail.value) }}
                                                value={messageToAppend}
                                                autoFocus
                                                disabled={false}
                                                placeholder="Enter the message here..."
                                            />
                                        </Form>
                                </Modal>
                            </SpaceBetween>
                        }
                        >
                            Messages
                        </Header>
                    }
                    pagination={
                        <PaginationRendering 
                            numberOfItems={(streamDetails?.storageStatus.newestSequenceNumber || 0) - (streamDetails?.storageStatus.oldestSequenceNumber || 0) + 1}
                            numberOfItemPerPage={preferences.pageSize || 1}
                            pageIndex={currentPageIndex}
                            onPageIndexChanged={ (pageIndex:any) => OnPageIndexChangedHanlder(pageIndex)}
                        />
                    }
                />
            </SpaceBetween>
        </ContentLayout>
      );
}

export default withRouter(StreamDetail);