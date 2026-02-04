import { Meeting } from '../shared/dto/meeting'

const store: { meetings: Meeting[] } = {
  meetings: [],
}

export const getMeetings = () => store.meetings
export const addMeeting = (meeting: Meeting) => store.meetings.push(meeting)