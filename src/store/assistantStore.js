export function createAssistantStore() {
  return {
    messages: [],
    addMessage(message) {
      this.messages = [...this.messages, message];
    },
  };
}
