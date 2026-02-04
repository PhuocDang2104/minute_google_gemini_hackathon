export const inMeetingStream = {
  subscribe: (cb: (event: string) => void) => {
    cb('transcript_event: stub')
    return () => void 0
  },
}