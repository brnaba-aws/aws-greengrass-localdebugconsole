
import React, { useContext, useEffect, useState, useReducer, useRef } from "react";
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
    Textarea,
    StatusIndicator,
    ButtonDropdown,
    FormField,
    Input,
    Select,
} from "@cloudscape-design/components";
import { RouteComponentProps, useHistory, withRouter } from "react-router-dom";
import { Stream, 
    Message, 
    formatBytes, 
    getExportType, 
    getElapsedTime,
    Persistence,
    StrategyOnFull,
    StreamManagerReducer,
} from "../util/StreamManagerUtils";
import { SERVER , DefaultContext} from "../index";
import { APICall } from "../util/CommUtils";
import { STREAM_MANAGER_ROUTE_HREF_PREFIX } from "../util/constNames";
import PaginationRendering from "../util/PaginationRendering";
import StreamExportDefinition from "./details/StreamExportDefinition"
import StreamManagerResponseMessage from "../util/StreamManagerResponseMessage";
interface StreamManagerProps extends RouteComponentProps {
}

const StreamDetail: React.FC<StreamManagerProps> = () => {

    const [messagesList, setMessagesList] = useState<Message[]>([])
    const [streamDetails, setStreamDetails] = useState<Stream>();
    const [messageCount, setMessageCount] = useState(0);
    const [currentPageIndex, setCurrentPageIndex] = useState(1)
    const previousPageIndex = useRef(currentPageIndex);
    const [describeStreamRequestInProgress, setDescribeStreamRequestInProgres] = useState(false);
    const [readMessagesStreamRequestInProgress, setReadMessageStreamRequestInProgres] = useState(false);
    const [appendMessageRequest, setAppendMessageRequest] = useState(false);
    const [updateMessageRequest, setUpdateMessageRequest] = useState(false);
    const [filteringText, setFilteringText] = useState("");
    const [viewAppendMessage, setViewAppendMessage] = useState(false);
    const [viewUpdateDefinition, setViewUpdateDefinition] = useState(false);
    const [viewUpdateExportDefinition, setViewUpdateExportDefinition] = useState(false);
    const [messageToAppend, setMessageToAppend] = useState("");
    const defaultContext = useContext(DefaultContext);
    const [updateStreamErrorText, setUpdateStreamErrorText] = useState("");
    let streamName = useHistory().location.pathname.substring(STREAM_MANAGER_ROUTE_HREF_PREFIX.length - 1);
    const [updateStream, dispatch] = useReducer(StreamManagerReducer, {
        name: "",
        maxSize: 0,
        streamSegmentSize: 0,
        strategyOnFull: StrategyOnFull.OverwriteOldestData,
        persistence: Persistence.File, 
        flushOnWrite: false,
        exportDefinition: {
            kinesis:[],
            http:[],
            iotAnalytics: [],
            IotSitewise: [],
            s3TaskExecutor: []
        }
    });
    const columnDefinitionsMessages: TableProps.ColumnDefinition<Message>[] = [
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

    const columnDefinitionsExportStatuses: TableProps.ColumnDefinition<any>[] = [
        {
            id: "exportConfigIdentifier",
            header: "Identifier",
            cell: (e:any) => e.exportConfigIdentifier
        },
        {
            id: "export Type",
            header: "Export type",
            cell: (e:any) => getExportType(e.exportConfigIdentifier, streamDetails)
        },
        {
            id: "lastExportedSequenceNumber",
            header: "Last exported sequence number",
            cell: (e:any) => e.lastExportedSequenceNumber
        },
        {
            id: "lastExportTime",
            header: "Last exported date",
            cell: (e:any) => (
                getElapsedTime(e.lastExportTime).toString()
            )
        },
        {
            id: "exportedMessagesCount",
            header: "Total exported messages",
            cell: (e:any) => e.exportedMessagesCount
        },
        {
            id: "exportedBytesFromStream",
            header: "Total exported bytes",
            cell: (e:any) => formatBytes(e.exportedBytesFromStream)
        },
        {
            id: "errorMessage",
            header: "Last error",
            cell: (e:any) => <StatusIndicator type={e.errorMessage?"error":'success'}>{e.errorMessage || 'None'}</StatusIndicator>
        }
    ];
    
    let storedPreferencesMessagesTable = localStorage.getItem('streamDetailsPreferencesMessages');
    if (!storedPreferencesMessagesTable){
        storedPreferencesMessagesTable =  JSON.stringify({
            pageSize: 100,
            visibleContent: ["sequenceNumber", "message", "ingestTime"]
        })
    }
    const [preferencesMessages, setPreferencesMessages] = useState<CollectionPreferencesProps.Preferences>(JSON.parse(storedPreferencesMessagesTable));
    
    let storedPreferenceStreamDetailsPage = localStorage.getItem('streamDetailsPreferencesView');
    if (!storedPreferenceStreamDetailsPage){
        storedPreferenceStreamDetailsPage =  JSON.stringify({
            visibleContent: ["details", "messages", "exportDefinitions","exportStatuses"]
        })
    }
    const [preferenceStreamDetailsPage, setPreferenceStreamDetailsPage] = useState<CollectionPreferencesProps.Preferences>(JSON.parse(storedPreferenceStreamDetailsPage));

    const items = [
        [
            {
                field: "Stream Segment Size",
                value: formatBytes(streamDetails?.messageStreamInfo.definition.streamSegmentSize),
            },
            {
                field: "Max Size",
                value: formatBytes(streamDetails?.messageStreamInfo.definition.maxSize),
            },
            {
                field: "Total size",
                value: formatBytes(streamDetails?.messageStreamInfo.storageStatus.totalBytes),
            },
        ],
        [
            {
                field: "Persistence",
                value: (streamDetails?.messageStreamInfo.definition.persistence === 0 ? "File":"Memory")
            },
            {
                field: "Strategy",
                value: (streamDetails?.messageStreamInfo.definition.strategyOnFull === 0 ? "RejectNewData": "OverwriteOldestData"),
            },
            {
                field: "Flush on write",
                value: (streamDetails?.messageStreamInfo.definition.flushOnWrite?'true':'false'),
            },
        ],
        [
            {
                field: "Newest sequence number",
                value: (streamDetails?.messageStreamInfo.storageStatus.newestSequenceNumber)
            },
            {
                field: "Oldest sequence number",
                value: (streamDetails?.messageStreamInfo.storageStatus.oldestSequenceNumber),
            },
            {
                field: "TTL on message",
                value: (streamDetails?.messageStreamInfo.definition.timeToLiveMillis),
            },
        ]
    ];

    const tabsStreamDefinition: TabsProps.Tab[] = [
        {
            id: "tabsStreamDefinition",
            label: "Stream definition",
            content: (
                describeStreamRequestInProgress===true?
                <StatusIndicator type="loading">      Loading    </StatusIndicator>:
                <ColumnLayout key={"tabsStreamDefinition"} columns={items.length} variant="text-grid">
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
    ];

    function OnPageIndexChangedHanlder (pageIndex:number) {
        setCurrentPageIndex(pageIndex);
    }

    const onClickRefresh = () => {
        describeStream(streamName, 0);
    }

    const describeStreamCallback = (streamName:string) => {
        describeStream(streamName, 0);
    }

    const onItemClick = (id:string) => {
        switch(id){
            case 'am':
                setViewAppendMessage(true);
                dispatch({type:'set_all',payload:{
                    name:streamDetails?.messageStreamInfo.definition.name,
                    maxSize:streamDetails?.messageStreamInfo.definition.maxSize,
                    streamSegmentSize: streamDetails?.messageStreamInfo.definition.streamSegmentSize,
                    strategyOnFull: streamDetails?.messageStreamInfo.definition.strategyOnFull,
                    persistence: streamDetails?.messageStreamInfo.definition.persistence, 
                    flushOnWrite: streamDetails?.messageStreamInfo.definition.flushOnWrite,
                    exportDefinition: streamDetails?.messageStreamInfo.definition.exportDefinition
                }, callbackError:setUpdateStreamErrorText});
                break;
            case 'ud':
                setViewUpdateDefinition(true);
                dispatch({type:'set_all',payload:{
                    name:streamDetails?.messageStreamInfo.definition.name,
                    maxSize:streamDetails?.messageStreamInfo.definition.maxSize,
                    streamSegmentSize: streamDetails?.messageStreamInfo.definition.streamSegmentSize,
                    strategyOnFull: streamDetails?.messageStreamInfo.definition.strategyOnFull,
                    persistence: streamDetails?.messageStreamInfo.definition.persistence, 
                    flushOnWrite: streamDetails?.messageStreamInfo.definition.flushOnWrite,
                    exportDefinition: streamDetails?.messageStreamInfo.definition.exportDefinition
                }, callbackError:setUpdateStreamErrorText});
                break;

            case 'ue':
                setViewUpdateExportDefinition(true);
                dispatch({type:'set_all',payload:{
                    name:streamDetails?.messageStreamInfo.definition.name,
                    maxSize:streamDetails?.messageStreamInfo.definition.maxSize,
                    streamSegmentSize: streamDetails?.messageStreamInfo.definition.streamSegmentSize,
                    strategyOnFull: streamDetails?.messageStreamInfo.definition.strategyOnFull,
                    persistence: streamDetails?.messageStreamInfo.definition.persistence, 
                    flushOnWrite: streamDetails?.messageStreamInfo.definition.flushOnWrite,
                    exportDefinition: streamDetails?.messageStreamInfo.definition.exportDefinition
                }, callbackError:setUpdateStreamErrorText});
                break;
        }
    }

    const onClickAppend = () => {
        setViewAppendMessage(true);
    }

    async function describeStream(streamName:string, index:number){
        setDescribeStreamRequestInProgres(true);
        SERVER.sendRequest({ call: APICall.streamManagerDescribeStream, args: [streamName] }).then(
            (response:StreamManagerResponseMessage) => 
            {
                if (response) {
                    if (response.successful) {
                        if (response.messageStreamInfo) {
                            const item:Stream = {
                                key:index,
                                messageStreamInfo:response.messageStreamInfo
                            };
                            setStreamDetails(item);
                            setMessageCount(item.messageStreamInfo.storageStatus.newestSequenceNumber-item.messageStreamInfo.storageStatus.oldestSequenceNumber + 1)
                            readMessages(streamName, item.messageStreamInfo.storageStatus.newestSequenceNumber)
                            setDescribeStreamRequestInProgres(false);
                        } else {
                            setDescribeStreamRequestInProgres(false);
                        }
                    } else {
                        setDescribeStreamRequestInProgres(false);
                    }
                } else {
                    setDescribeStreamRequestInProgres(false);
                }
            },
            (reason) => {
                console.log("Error in [StreamManager]: " + reason);
                setDescribeStreamRequestInProgres(false);
            }
        );
    }

    async function readMessages(streamName:string, desiredStartSequenceNumber:number){
        setReadMessageStreamRequestInProgres(true);
        if (desiredStartSequenceNumber >= 0)
        {
            setMessagesList([]);
            if (desiredStartSequenceNumber - (preferencesMessages.pageSize || 100)*(currentPageIndex-1) >= (preferencesMessages.pageSize || 100)){
                SERVER.sendRequest({ call: APICall.streamManagerReadMessages, args: [streamName, desiredStartSequenceNumber - (preferencesMessages.pageSize || 100)*(currentPageIndex) + 1, 1, (preferencesMessages.pageSize || 100), 5000] }).then(
                    (response:StreamManagerResponseMessage) => {
                        if (response) {
                            if (response.successful) {
                                if (response.messagesList){
                                    const listMessageDescending:Message[] = response.messagesList;
                                    listMessageDescending.sort((a:any, b:any) => b.sequenceNumber - a.sequenceNumber);
                                    setMessagesList(listMessageDescending);
                                    setReadMessageStreamRequestInProgres(false);
                                }
                                else {
                                    setReadMessageStreamRequestInProgres(false);
                                }
                            } else {
                                setReadMessageStreamRequestInProgres(false);
                            }
                        } else {
                            setReadMessageStreamRequestInProgres(false);
                        }
                    },
                    (reason) => {
                        setReadMessageStreamRequestInProgres(false);
                        console.log("Error in [StreamManager]: " + reason);
                    }
                );
            }
            else{
                SERVER.sendRequest({ call: APICall.streamManagerReadMessages, args: [streamName, 0, 1, desiredStartSequenceNumber - (preferencesMessages.pageSize || 100)*(currentPageIndex-1) + 1, 5000] }).then(
                    (response) => {
                        if (response) {
                            if (response.successful) {
                                if (response.messagesList){
                                    const listMessageDescending:Message[] = response.messagesList.sort((a:any, b:any) => b.sequenceNumber - a.sequenceNumber);
                                    setMessagesList(listMessageDescending);
                                    setReadMessageStreamRequestInProgres(false);
                                }
                                else {
                                    setReadMessageStreamRequestInProgres(false);
                                }
                            } else {
                                setReadMessageStreamRequestInProgres(false);
                            }
                        } else {
                            setReadMessageStreamRequestInProgres(false);
                        }
                    },
                    (reason) => {
                        setReadMessageStreamRequestInProgres(false);
                        console.log("Error in [StreamManager]: " + reason);
                    }
                );
            }
        }
        else {
            //empty stream
            setReadMessageStreamRequestInProgres(false);
        }
    }

    const onDismiss = () => {
        setViewAppendMessage(false);
        setMessageToAppend("");
        setViewUpdateDefinition(false)
        setViewUpdateExportDefinition(false);
    }

    const appendMessageClick = () => {
        setAppendMessageRequest(true);
        SERVER.sendRequest({ call: APICall.streamManagerAppendMessage, args: [streamName, messageToAppend] }).then(
            (response:StreamManagerResponseMessage) => {
                if (response) 
                {
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

    const onClickUpdate = (e:any) => {
        if (streamDetails){
            setUpdateMessageRequest(true);
            SERVER.sendRequest({ call: APICall.streamManagerUpdateMessageStream, args: [JSON.stringify(updateStream)] }).then(
                (response:StreamManagerResponseMessage) => {
                    if (response) {
                        console.log(response);
                        setUpdateMessageRequest(false);
                        defaultContext.addFlashItem!({
                            type: response.successful === true?'success':'error',
                            header: response.successful === true?streamName+' has been updated':'Failed to update ' + streamName,
                            content: response.errorMsg
                        });
                        describeStream(streamName, 0);
                    }
                    setUpdateMessageRequest(false);
                    setViewUpdateDefinition(false)
                },
                (reason) => {
                    console.log("Error in [StreamManager]: " + reason);
                }
            );
        }
    }

    const onClickUpdateExportDefinition = () => {
        setViewUpdateExportDefinition(true);
    }

    useEffect(() => {
        if (previousPageIndex.current !== currentPageIndex){
            readMessages(streamName, streamDetails?.messageStreamInfo.storageStatus.newestSequenceNumber || 0);
            previousPageIndex.current = currentPageIndex;
        }
        else {
            describeStream(streamName, 0);
        }
    }, [currentPageIndex]);

    return (
        <ContentLayout key={"streamDetails"} 
            header={
                <Header 
                    variant={"h1"}
                    actions={
                        <SpaceBetween key={"SpaceBetweenButtonsStreamDetails"} direction="horizontal"  size="xs">
                            <Button     
                                ariaDescribedby={"refresh"}
                                ariaLabel="Refresh" 
                                key={"Refresh"}
                                onClick = {() => {
                                    onClickRefresh();
                                }}
                                iconName="refresh" 
                                wrapText={false}
                                disabled={describeStreamRequestInProgress || readMessagesStreamRequestInProgress}
                            >
                            </Button>
                            <ButtonDropdown
                                disabled={describeStreamRequestInProgress || readMessagesStreamRequestInProgress}
                                items={[
                                    { text: "Update definition", id: "ud", disabled: false },
                                    { text: "Update exports", id: "ue", disabled: false },
                                    { text: "Add message", id: "am", disabled: false },
                                ]}
                                onItemClick={(e) => onItemClick(e.detail.id)}
                                >
                                Actions
                            </ButtonDropdown>
                            <CollectionPreferences
                                    key={"CollectionPreferencesStream"}
                                    visibleContentPreference={{
                                        title: "Visible items",
                                        options: [{
                                            label: "", options: [
                                                {editable: true, label: "Stream details", id: "details"},
                                                {editable: true, label: "Export statuses", id: "exportStatuses"},
                                                {editable: true, label: "Export definitions", id: "exportDefinitions"},
                                                {editable: true, label: "messages", id: "messages"},
                                            ]
                                        }]
                                    }}
                                    title={"Preferences"}
                                    confirmLabel={"Ok"}
                                    cancelLabel={"Cancel"}
                                    preferences={preferenceStreamDetailsPage}
                                    onConfirm={({detail}) => {setPreferenceStreamDetailsPage(detail);localStorage.setItem("streamDetailsPreferencesView", JSON.stringify(detail))}}
                        />
                        </SpaceBetween>
                    }
                >
                    {streamName}
                </Header>
            }
        >
            <SpaceBetween key={"SpaceBetweenStreamDetails"} direction="vertical"  size="l">
                {
                    (preferenceStreamDetailsPage.visibleContent?.some((e:string) => e==="details")!==false) && 
                    <Container key={"Container"}>
                        <Tabs 
                            key={"tabsStreamDefinition"} 
                            tabs={tabsStreamDefinition}
                        />
                    </Container>
                }
                {
                    (preferenceStreamDetailsPage.visibleContent?.some((e:string) => e==="exportDefinitions")!==false) &&
                    <Container variant="default">
                        {streamDetails && 
                            <StreamExportDefinition streamProps={streamDetails} 
                                loadingFlagProps={describeStreamRequestInProgress}
                                describeStreamCallbackPros={describeStreamCallback}
                            >
                            </StreamExportDefinition>
                        }
                        
                    </Container>
                }
                {
                    (preferenceStreamDetailsPage.visibleContent?.some((e:string) => e==="exportStatuses")!==false) && 
                    <Table
                        key={"ExportStatusesTable"}
                        columnDefinitions={columnDefinitionsExportStatuses}
                        sortingDisabled
                        loading={describeStreamRequestInProgress}
                        loadingText="Loading export statuses."
                        wrapLines={true}
                        items={streamDetails?.messageStreamInfo.exportStatuses || []}
                        empty={
                            <Box
                            margin={{ vertical: "xs" }}
                            textAlign="center"
                            color="inherit"
                            >
                            <SpaceBetween size="m">
                                <b>No exported statuses.</b>
                            </SpaceBetween>
                            </Box>
                        }
                        header={
                            <Header
                                key={"counterHeader"}
                                counter=
                                {
                                    "(" + (streamDetails?.messageStreamInfo.exportStatuses.length || 0)  +")"
                                }
                            >
                                Export statuses
                            </Header>
                        }
                    ></Table>
                }
                {
                    (preferenceStreamDetailsPage.visibleContent?.some((e:string) => e==="messages")!==false) &&
                    <Table
                        key={"messageTable"}
                        empty={
                            <Box key={"box1"} textAlign="center" color="inherit">
                                <b>No messages</b>
                                <Box
                                    key={"box1-1"}
                                    padding={{ bottom: "s" }}
                                    variant="p"
                                    color="inherit"
                                >
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
                                </Box>
                            </Box>
                        }
                        trackBy="sequenceNumber"
                        loading={readMessagesStreamRequestInProgress}
                        wrapLines={true}
                        loadingText="Loading messages"
                        items={messagesList.filter((m:Message) => atob(m.payload?.toString() || '').includes(filteringText.toLowerCase())).slice(0,preferencesMessages.pageSize || 100)}
                        filter={
                            <TextFilter
                                key={"findMessageTextFilter"}
                                filteringPlaceholder="Find message(s)"
                                filteringText={filteringText}
                                onChange={({detail}) =>setFilteringText(detail.filteringText)}
                            />
                        }
                        columnDefinitions={columnDefinitionsMessages}
                        visibleColumns={preferencesMessages.visibleContent}
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
                                preferences={preferencesMessages}
                                onConfirm={({detail}) => {setPreferencesMessages(detail);localStorage.setItem("streamDetailsPreferencesMessages", JSON.stringify(detail))}}
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
                                    {messageCount > 0 && <Button
                                        ariaDescribedby={"Add message"}
                                        ariaLabel="Add message" 
                                        key={"Append2"}
                                        onClick = {() => {
                                            onClickAppend();
                                        }}
                                        iconName="add-plus"
                                        wrapText={false}
                                        disabled={appendMessageRequest || describeStreamRequestInProgress || readMessagesStreamRequestInProgress}
                                    >
                                        Add Message
                                    </Button>}
                                    <Modal
                                        key={"ModalAppendMessage"}
                                        onDismiss={onDismiss}
                                        visible={viewAppendMessage}
                                        size="medium"
                                        footer={
                                            <Box key={"1"} float="right">
                                                <SpaceBetween key={"SpaceBetween2"} direction="horizontal" size="xs">
                                                    <Button 
                                                        key={"ModalAppendMessageCancelButton"}
                                                        variant="link" 
                                                        onClick={onDismiss}
                                                        ariaDescribedby={"Cancel"}
                                                        ariaLabel="Cancel" 
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button 
                                                        key={"ModalAppendMessageAddButton"}
                                                        variant="primary" 
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
                                key={"paginatinoRendering"}
                                numberOfItems={(streamDetails?.messageStreamInfo.storageStatus.newestSequenceNumber || 0) - (streamDetails?.messageStreamInfo.storageStatus.oldestSequenceNumber || 0) + 1}
                                numberOfItemPerPage={preferencesMessages.pageSize || 1}
                                pageIndex={currentPageIndex}
                                onPageIndexChanged={ (pageIndex:any) => OnPageIndexChangedHanlder(pageIndex)}
                            />
                        }
                    />
                }
            </SpaceBetween>
            <Modal
                key={"ModalUpdateDefinition"}
                onDismiss={onDismiss}
                visible={viewUpdateDefinition}
                size="medium"
                header={'Update '+streamName + ' definition'}
            >
                <Form
                    variant="embedded"
                    actions={
                        <SpaceBetween direction="horizontal" size="xs">
                            <Button 
                                formAction="none"
                                variant="link"
                                ariaDescribedby={"Cancel"}
                                ariaLabel="Cancel"
                                onClick={onDismiss}
                            >
                                Cancel
                            </Button>
                            <Button 
                                loading={false} 
                                disabled={updateStreamErrorText.length !== 0}
                                variant="primary"
                                ariaDescribedby={"Update"}
                                ariaLabel="Update"
                                onClick={(e) => onClickUpdate(e)}
                            >
                                Update
                            </Button>
                        </SpaceBetween>
                    }
                    errorText={updateStreamErrorText !== ''? updateStreamErrorText: false}
                >
                        <SpaceBetween direction="vertical" size="l">
                            <FormField 
                                label="Stream Name"
                                constraintText="Must be an alphanumeric string including spaces, commas, periods, hyphens, and underscores with length between 1 and 255."
                            >
                                <Input
                                    value={updateStream.name || ''}
                                    disabled={true}
                                />
                            </FormField>
                            <FormField 
                                label="Stream Max Size (in bytes)"
                                constraintText="Set to 256MB by default with a minimum of 1KB and a maximum of 8192PB."
                            >
                                <Input
                                    value={updateStream.maxSize.toString() || ''}
                                    onChange={(event) => dispatch({type: 'set_maxSize', payload: event.detail.value, callbackError:setUpdateStreamErrorText})}
                                    disabled={false}
                                    step={1024}
                                    inputMode="decimal"
                                    type="number"
                                />
                            </FormField>
                            <FormField 
                                constraintText="Set to 16MB by default with a minimum of 1KB and a maximum of 2GB."
                                label="Stream Segment Size (in bytes)"
                            >
                                <Input
                                    value={updateStream.streamSegmentSize.toString() || ''}
                                    onChange={(event) => dispatch({type: 'set_streamSegmentSize', payload: event.detail.value, callbackError:setUpdateStreamErrorText})}
                                    disabled={false}
                                    step={1024}
                                    inputMode="decimal"
                                    type="number"
                                />
                            </FormField>
                            <FormField label="Strategy on full">
                                <Select
                                    options={[
                                        { label: "OverwriteOldestData", value: "1" },
                                        { label: "RejectNewData", value: "0" }
                                    ]}
                                    selectedOption={updateStream.strategyOnFull===StrategyOnFull.OverwriteOldestData?{ label: "OverwriteOldestData", value: "1" }:{ label: "RejectNewData", value: "0" }}
                                    onChange={({ detail }) => dispatch({type: 'set_strategyOnFull', payload: detail.selectedOption.value, callbackError:setUpdateStreamErrorText})}
                                    disabled={false}
                                />
                            </FormField>
                            <FormField 
                                label="Persistence"
                                constraintText="If set to File, the file system will be used to persist messages long-term and is resilient to restarts.
                                Memory should be used when performance matters more than durability as it only stores the stream in memory and never writes to the disk."
                            >
                                <Select
                                    options={[
                                        { label: "File", value: "0" },
                                        { label: "Memory", value: "1" }
                                    ]}
                                    selectedOption={updateStream.persistence===Persistence.File?{ label: "File", value: "0" }:{ label: "Memory", value: "1" }}
                                    onChange={({ detail }) => dispatch({type: 'set_persistence', payload: detail.selectedOption.value, callbackError:setUpdateStreamErrorText})}
                                    disabled={false}
                                />
                            </FormField>
                            {updateStream.persistence===Persistence.File && <FormField 
                                label="Flush on write" 
                                constraintText="Waits for the filesystem to complete the write for every message. This is safer, but slower. Default is false."
                            >
                                <Select
                                    options={[
                                        { label: "True", value: "0" },
                                        { label: "False", value: "1" }
                                    ]}
                                    selectedOption={updateStream.flushOnWrite===true?{ label: "True", value: "0" }:{ label: "False", value: "1" }}
                                    onChange={({ detail }) =>  dispatch({type: 'set_flushOnWrite', payload: detail.selectedOption.value, callbackError:setUpdateStreamErrorText})}
                                    disabled={false}
                                />
                            </FormField>}
                        </SpaceBetween>
                    </Form>
            </Modal>

            <Modal
                key={"ModalUpdateExportDefinition"}
                onDismiss={onDismiss}
                visible={viewUpdateExportDefinition}
                size="large"
                header={'Update '+streamName + ' export definitions'}>
                    <Form
                    variant="embedded"
                    actions={
                        <SpaceBetween direction="horizontal" size="xs">
                            <Button 
                                formAction="none"
                                variant="link"
                                ariaDescribedby={"Cancel"}
                                ariaLabel="Cancel"
                                onClick={onDismiss}
                            >
                                Cancel
                            </Button>
                            <Button 
                                loading={false} 
                                disabled={updateStreamErrorText.length !== 0}
                                variant="primary"
                                ariaDescribedby={"Update"}
                                ariaLabel="Update"
                                onClick={(e) => onClickUpdate(e)}
                            >
                                Update
                            </Button>
                        </SpaceBetween>
                    }
                    errorText={updateStreamErrorText !== ''? updateStreamErrorText: false}
                >
                    {
                    streamDetails && 
                        <StreamExportDefinition streamProps={streamDetails} 
                            loadingFlagProps={false}
                            describeStreamCallbackPros={describeStreamCallback}
                        >
                        </StreamExportDefinition>
                    }
                </Form>
                
            </Modal>
        </ContentLayout>
      );
}

export default withRouter(StreamDetail);