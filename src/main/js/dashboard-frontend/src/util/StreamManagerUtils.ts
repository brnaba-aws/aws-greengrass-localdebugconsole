export function formatBytes (bytes?: number | null): string {
    if (bytes === null || bytes === undefined) {
      return '-';
    } else if (bytes < 1024) {
      return bytes + ' bytes';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(2) + ' KB';
    } else if (bytes < 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    } else {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
};

export function getExportDefinitionType(exportDefinition: ExportDefinition): string {
  const exportTypes: string[] = [];

  if (exportDefinition.kinesis && exportDefinition.kinesis.length > 0) {
    exportTypes.push('Kinesis');
  }
  if (exportDefinition.http && exportDefinition.http.length > 0) {
    exportTypes.push('HTTP');
  }
  if (exportDefinition.iotAnalytics && exportDefinition.iotAnalytics.length > 0) {
    exportTypes.push('IoT Analytics');
  }
  if (exportDefinition.IotSitewise && exportDefinition.IotSitewise.length > 0) {
    exportTypes.push('IoT Sitewise');
  }
  if (exportDefinition.s3TaskExecutor && exportDefinition.s3TaskExecutor.length > 0) {
    exportTypes.push('S3');
  }

  return exportTypes.join(' - ');
}

export const getElapsedTime = (elapsedtimesec:number) => {
  if (elapsedtimesec > 0) {
      const elapsedSeconds = Math.floor((Date.now() - elapsedtimesec)/1000);
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);
      const elapsedHours = Math.floor(elapsedSeconds / 60 / 60);
      
      if (elapsedSeconds < 1) {
        return `Just now`;
      }
      else if (elapsedMinutes < 1) {
        return `${elapsedSeconds} seconds ago`;
      } else if (elapsedMinutes < 60) {
        return `${elapsedMinutes} minute${elapsedMinutes !== 1 ? 's' : ''} ago`;
      } else if (elapsedHours < 24) {
        return `${elapsedHours} hour${elapsedHours !== 1 ? 's' : ''} ago`;
      }
      else {
        const elapsedDays = Math.floor(elapsedHours / 24);
        return `${elapsedDays} day${elapsedDays !== 1 ? 's' : ''} ago`;
      }
  }
  else {
      return '-'
  }
};

export const getExportType = (identifier: string, streamDetails: Stream | undefined) => {
  const exportTypes = [
    { type: 'Kinesis', key: 'kinesis' },
    { type: 'IoT Analytics', key: 'iotAnalytics' },
    { type: 'IoT SiteWise', key: 'IotSitewise' },
    { type: 'HTTP', key: 'http' },
    { type: 'S3', key: 's3TaskExecutor' },
  ];

  if (streamDetails) {
    for (const exportType of exportTypes) {
      const exportDefinitionArray = streamDetails.messageStreamInfo.definition.exportDefinition?streamDetails.messageStreamInfo.definition.exportDefinition[exportType.key]:{
        kinesis:[],
        http:[],
        iotAnalytics: [],
        IotSitewise: [],
        s3TaskExecutor: []
    };
      if (exportDefinitionArray) {
        const match = exportDefinitionArray.find(
          (exportDefinition:any) => exportDefinition.identifier === identifier
        );
        if (match) {
          return exportType.type;
        }
      }
    }
  }
};


export interface IoTAnalyticsConfig {
  identifier:string,
  iotChannel:string,
  iotMsgIdPrefix:string,
  batchSize:number,
  batchIntervalMillis:number,
  priority:number,
  startSequenceNumber:number,
  disabled:boolean
}

export enum ExportFormat {
  RAW_NOT_BATCHED=0,
  JSON_BATCHED=1
}

export interface KinesisConfig {
  identifier:string,
  kinesisStreamName:string,
  batchSize?:number,
  batchIntervalMillis?:number,
  priority:number,
  startSequenceNumber:number,
  disabled:boolean
}


export interface HTTPConfig {
  identifier:string,
  uri:string,
  batchSize:number,
  batchIntervalMillis:number,
  priority:number,
  startSequenceNumber:number,
  disabled:boolean,
  exportFormat:ExportFormat
}

export interface IoTSiteWiseConfig {
  identifier:string,
  batchSize:number,
  batchIntervalMillis:number,
  priority:number,
  startSequenceNumber:number,
  disabled:boolean
}

export enum StatusLevel {
  ERROR=0,
  WARN=1,
  INFO=2,
  DEBUG=3,
  TRACE=4,
}
export const statusLevelText = {
  [StatusLevel.ERROR]: 'Error',
  [StatusLevel.WARN]: 'Warning',
  [StatusLevel.INFO]: 'Information',
  [StatusLevel.DEBUG]: 'Debug',
  [StatusLevel.TRACE]: 'Trace',
};

export interface StatusConfig {
  statusLevel:StatusLevel,
  statusStreamName: string
}

export interface S3ExportTaskExecutorConfig {
  identifier:string,
  sizeThresholdForMultipartUploadBytes:number,
  priority:number,
  disabled:boolean,
  statusConfig:StatusConfig
}

export enum Persistence {
    File,
    Memory
}

export enum StrategyOnFull {
  RejectNewData=0,
  OverwriteOldestData=1
}

export interface ExportDefinition {
    kinesis: KinesisConfig[];
    http: HTTPConfig[];
    iotAnalytics: IoTAnalyticsConfig[];
    IotSitewise: IoTSiteWiseConfig[];
    s3TaskExecutor: S3ExportTaskExecutorConfig[];
    [key: string]: any; // Index signature to allow indexing with strings
}

interface StorageStatus {
    newestSequenceNumber: number;
    oldestSequenceNumber: number;
    totalBytes: number;
}

export interface ExportStatus {
    errorMessage: string;
    exportConfigIdentifier: string;
    exportedBytesFromStream: number;
    exportedMessagesCount: number;
    lastExportTime: number;
    lastExportedSequenceNumber: number;
}

export interface MessageStreamInfo {
  definition: MessageStreamDefinition;
  storageStatus: StorageStatus;
  exportStatuses: ExportStatus[];
}
export interface Stream {
    key: number;
    messageStreamInfo:MessageStreamInfo;
}

export interface StreamManagerComponentConfiguration {
  Version: string;
  JVM_ARGS: string;
  LOG_LEVEL: string;
  STREAM_MANAGER_AUTHENTICATE_CLIENT: string;
  STREAM_MANAGER_EXPORTER_MAX_BANDWIDTH: string;
  STREAM_MANAGER_EXPORTER_THREAD_POOL_SIZE: string;
  STREAM_MANAGER_EXPORTER_S3_DESTINATION_MULTIPART_UPLOAD_MIN_PART_SIZE_BYTES: string;
  STREAM_MANAGER_SERVER_PORT: string;
  STREAM_MANAGER_STORE_ROOT_DIR: string;
}

export interface Message {
  streamName: string;
  sequenceNumber?: number | null; // Use number or null to represent Long or optional
  ingestTime?: number | null; // Use number or null to represent Long or optional
  payload: Uint8Array | null; // Use Uint8Array or null to represent byte[] or optional
}

export interface MessageStreamDefinition {
  name: string,
  maxSize: number,
  streamSegmentSize: number,
  timeToLiveMillis?: number,
  strategyOnFull: StrategyOnFull,
  persistence: Persistence ,
  flushOnWrite: boolean,
  exportDefinition: ExportDefinition,
}

export function validateMessageStreamDefinition(messageStreamDefinition:MessageStreamDefinition, setErrorcallbackError:any){
  
}
export function StreamManagerReducer(state:any, action:any) {
  switch (action.type) {
      case "set_name":
          const alphanumericRegex = /^[a-zA-Z0-9\s,.\-_]+$/;
          if (action.payload.length === 0) {
            action.callbackError('Name cannot be empty.');
          } else if (action.payload.length < 1 || action.payload.length > 255) {
            action.callbackError('Name length must be between 1 and 255 characters.');
          } else if (!alphanumericRegex.test(action.payload)) {
            action.callbackError('Name must be alphanumeric and can include spaces, commas, periods, hyphens, and underscores.');
          } else {
            action.callbackError('');
          }
          return {
              ...state,
              name: action.payload
          };
      case "set_maxSize":
          if (parseInt(action.payload, 10) < 1024) {
            action.callbackError('Max size cannot be lower than 1024 bytes.');
          }
          else {
            action.callbackError('');
          }
          return {
              ...state,
              maxSize: parseInt(action.payload, 10)
          };
      case "set_streamSegmentSize":
          if (parseInt(action.payload, 10) < 1024) {
            action.callbackError('stream segment size cannot be lower than 1024 bytes.');
          }
          else {
            action.callbackError('');
          }
          return {
              ...state,
              streamSegmentSize: parseInt(action.payload, 10)
          };
      case "set_strategyOnFull":
          return {
              ...state,
              strategyOnFull: parseInt(action.payload, 10)
          };
      case "set_persistence":
          return {
              ...state,
              persistence: parseInt(action.payload, 10)
          };
      case "set_flushOnWrite":
          return {
              ...state,
              flushOnWrite: parseInt(action.payload)===0?true:false
          };
      case "clear":
          action.callbackError('');
          return {
              name: "new-stream",
              maxSize:256*1024*1024,
              streamSegmentSize: 16*1024*1024,
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
          };

      case "set_all":
        return {
            name: action.payload.name,
            maxSize:action.payload.maxSize,
            streamSegmentSize: action.payload.streamSegmentSize,
            strategyOnFull: action.payload.strategyOnFull,
            persistence: action.payload.persistence, 
            flushOnWrite: action.payload.flushOnWrite,
            exportDefinition: action.payload.exportDefinition
        };
  }
}
