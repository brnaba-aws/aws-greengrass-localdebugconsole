import { MessageStreamInfo, Message } from "./StreamManagerUtils";

class StreamManagerResponseMessage {
  public successful: boolean;
  public errorMsg: string | null;
  public messageStreamInfo: MessageStreamInfo | null;
  public messagesList: Message[];
  public streamsList: string[];

  // Default constructor
  constructor() {
    // Set default values for each attribute
    this.successful = false; // Default boolean value
    this.errorMsg = null; // Default null for String
    this.messageStreamInfo = null; // Default null for Object
    this.messagesList = []; // Default empty list
    this.streamsList = []; // Default empty list
  }
}

export default StreamManagerResponseMessage;
