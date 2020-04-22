import {html, render} from 'lit-html'
import enolib from 'enolib'
import moment from 'moment'

const dayHeader = (dayText) => html`
	<tr class="separator">
      <td colspan="3">${dayText}</td>
    </tr>
    `
const singleEvent = (time, eventText, host) => html`
	<tr>
	  <td class="time">${time}</td>
	  <td class="event">${eventText}</td>
	  <td class="host">${host}</td>
	</tr>
`

const scheduleTemplate = (scheduleData) => {
	let dayTemplates = []
	const dayFormat = 'dddd, LL'
	const timeFormat = 'hh:mm A'
	
	scheduleData.eventsByDay.forEach( events => {
		// All events in this day should have the same day
		// Gonna arbitrarily pick the first day 
		const dayText = moment(events[0].time).format(dayFormat)
		
		dayTemplates.push( dayHeader(dayText) )

		events.forEach( event => {
			const timeText = moment(event.time).format(timeFormat) 
			dayTemplates.push( singleEvent(timeText, event.name, event.host) )
		})

	})

	return html`${dayTemplates}`

}

const headerTemplate = (title, tz) => html`
	<h1>${title}</h1>
	<p>Time is automatically set to the detected timezone (${tz})
`


async function processInput(filename) {
	// TODO: Error and format checking
	const response = await fetch(filename)
	const input = await response.text()
	const doc = enolib.parse(input, { source: filename})

	// Convert timezone e.g. 
	// from 7 to +07, from -6 to -06
	// 0 should also be converted to +0 
	let tz = doc.field('Timezone').requiredStringValue()
	if (tz[0] != "+" && tz[0] != "-") {
		tz = "+" + tz
	}
	if (tz[2] === undefined) {
		tz = tz.slice(0,1) + "0" + tz[1] 
	}

	let scheduleData = { 
		tz,
		title: doc.field('Title').optionalStringValue(), 
		events: []
	}


	function isDaySection(el) {
		const isSection = el.yieldsSection()
		const isDay = el.stringKey().slice(0,3) === "Day"
		return isSection && isDay
	}

	function processDay(daySection) {
		const rawDate = daySection.field('Date').requiredStringValue()
		let formattedEvents = []

		daySection.sections('Event').forEach(event => {
			let name = event.field('Name').optionalStringValue()
			let host = event.field('Host').optionalStringValue()
			let rawTime = event.field('Time').requiredStringValue()
			
			// Format time to 24-hour 
			rawTime = moment(rawTime, 'LTS').format('HH:MM')

			let time = `${rawDate} ${rawTime}${tz}` 

			let formattedEvent = { name, host, time }

			formattedEvents.push(formattedEvent)
		})

		return formattedEvents
	}

	function divideByLocalDay(events) {
		const dayFormat = 'dddd, LLL'
		let dayEvents = []

		events.forEach(event => {
			// If it's the first event, just add
			// a new day
			if (dayEvents.length <= 0) {
				dayEvents.push([event])
				return
			}

			let todayEvents = dayEvents[dayEvents.length - 1]
			let today = todayEvents[0].time

			// If it's the same date as today, add the event to today
			// Otherwise, make a new day array
			if ( moment(event.time).isSame(today, 'day') ) {
				todayEvents.push(event)
			}
			else {
				dayEvents.push([event])
			}

		})

		return dayEvents

	}

	doc.elements().forEach(el => {
		if (isDaySection(el)) {
			let dayEvents = processDay( doc.section(el.stringKey()) )
			dayEvents.forEach(event => {
				scheduleData.events.push(event)
			})
		}
	})

	scheduleData.eventsByDay = divideByLocalDay(scheduleData.events)

	return scheduleData
}

window.addEventListener('DOMContentLoaded', async () => {

	let scheduleContainer = document.getElementById('awakening-schedule')
	let scheduleBody = scheduleContainer.querySelector('tbody')
	let headerBody = document.querySelector('header')

	const scheduleData = await processInput('awakening.eno') 
	console.log(scheduleData)

	render(scheduleTemplate(scheduleData), scheduleBody)
	render(headerTemplate(scheduleData.title, moment().format('Z')), headerBody)

})
	
