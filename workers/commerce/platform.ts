export interface QueueRetryOptions {
  delaySeconds?: number
}

export interface QueueMessage<Body> {
  readonly id: string
  readonly timestamp: Date
  readonly body: Body
  readonly attempts: number
  retry(options?: QueueRetryOptions): void
  ack(): void
}

export interface QueueMessageBatch<Body> {
  readonly messages: readonly QueueMessage<Body>[]
  readonly queue: string
  readonly metadata: {
    metrics: {
      backlogCount: number
      backlogBytes: number
      oldestMessageTimestamp?: Date
    }
  }
  retryAll(options?: QueueRetryOptions): void
  ackAll(): void
}
