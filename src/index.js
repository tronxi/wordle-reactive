import {
  startWith,
  fromEvent,
  map,
  Subject,
  scan,
  combineLatestWith
} from "rxjs";

import {Map} from "immutable";

const DELETE_KEY = "DEL";
const SEND_KEY = "SEND";
const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 6;

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "Ñ", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

const ColorsScore = {
  Green: 3,
  Yellow: 2,
  Grey: 1,
  White: 0
}

const ColorsClass = {
  Green: "green",
  Yellow: "yellow",
  Grey: "grey",
  White: "white"
}

class Letter {
  constructor(letter, colorScore, colorClass) {
    this.letter = letter;
    this.colorScore = colorScore;
    this.colorClass = colorClass;
  }
}

class ResponseStatus {
  constructor(letter, numScored) {
    this.letter = letter;
    this.numScored = numScored;
  }
}


const secretInputComponent = document.getElementById('secretInputComponent');
const wordleComponent = document.getElementById('wordleComponent');
const keyboardDom = document.getElementById('keyboard');
const deleteDom = document.getElementById('delete');
const sendResponseDom = document.getElementById('sendResponse');
const cumulativeResponsesDom = document.getElementById('cumulativeResponses');
const actualResponseDom = document.getElementById('actualResponse');


const secretInputDom = document.getElementById('secretInput');
const secretSendButtonDom = document.getElementById('secretSendButton');

const secretInput$ = fromEvent(secretInputDom, 'input').pipe(
    startWith(null),
    map(() => secretInputDom.value)
);
const buttonDisabled$ = secretInput$.pipe(
    map(input => input.trim().length !== WORD_LENGTH)
);
buttonDisabled$.subscribe(
    buttonDisabled => secretSendButtonDom.disabled = buttonDisabled
);
fromEvent(secretSendButtonDom, 'click')
.subscribe( _ => initWordle());




const keyboardInputs$ = new Subject();
const responses$ = new Subject();
const keyboardScores$ = new Subject();

function initWordle() {
  secretInputComponent.hidden = true;
  wordleComponent.hidden = false;
  createKeyboard();
  createActualResponse("     ");
  initKeyboardEvents();

  keyboardInputs$.pipe(
      scan((prev, cur) => performButtonAction(prev, cur))
  )
  .subscribe((actual) => createActualResponse(actual.padEnd(WORD_LENGTH, " ")));

  responses$.pipe(
      combineLatestWith(secretInput$),
      scan(([prev,_], [cur,input]) =>  [[...prev, cur], input.toUpperCase()],[[]])
  )
  .subscribe(([responses, input]) => createCumulativeResponses(responses, input));

  keyboardScores$.pipe(
      scan((prev, cur) => [...prev, cur], []),
      map(list => convertToSet(list))
  )
  .subscribe(x => updateKeyboardColors(x));
}

function convertToSet(list) {
  return list.reduce((map, element) => {
    if(map.has(element.letter)) {
      if(element.colorScore > map.get(element.letter).colorScore) {
        return map.set(element.letter, element);
      }
    } else {
      return map.set(element.letter, element);
    }
    return map;
  }, Map());
}

function createKeyboard() {
  LETTERS.map(letter => keyboardDom.innerHTML += createKey(letter));
}
function createKey(letter) {
  return `
  <div id=${letter} class="key">
    ${letter}
  </div>`;
}

function createActualResponse(response) {
  actualResponseDom.innerHTML = createResponseRow(response);
}

function createResponseRow(response) {
  return `
  <div>
    ${response.split("")
  .map(letter => createResponseKey(letter))
  .join('')}
  </div>`;
}
function createResponseKey(letter) {
  return `
  <div class="key">
    ${letter}
  </div>`
}

function performButtonAction(prev, cur)  {
  if(cur === DELETE_KEY) return removeLastChar(prev);
  else if (cur === SEND_KEY) {
    responses$.next(prev);
    return "";
  } else if (prev.length === WORD_LENGTH) return prev;
  else return prev + cur;
}

function removeLastChar(text) {
  return text.substring(0, text.length - 1)
}

function updateKeyboardColors(map) {
  map.map((v,k) => {
    const key = document.getElementById(k)
    key.className = '';
    key.classList.add('key');
    key.classList.add(v.colorClass);
  });
}

function createCumulativeResponses(responses, input) {
  cumulativeResponsesDom.innerHTML = "";
  responses.map(response => cumulativeResponsesDom.innerHTML
      += createCumulativeResponseRow(response, input));
  if(responses[responses.length - 1] === input) {
    setTimeout(() => {
      alert("Has ganado!");
      location.reload();
    }, 1000);

  }else if(responses.length === MAX_ATTEMPTS) {
    setTimeout(() => {
      alert("Has perdido");
      location.reload();
    }, 1000);
  }
}
function createCumulativeResponseRow(response, input) {
  let numScored = new Map();
  return `
  <div>
    ${response.split("").map((letter, index) => {
    let responseStatus = scoreLetter(input, letter, index, response, numScored);
    numScored = responseStatus.numScored;
    return responseStatus;
  })
  .map(letter => createCumulativeResponseKey(letter.letter))
  .join('')}
  </div>`;
}

function scoreLetter(input, letter, index, response, numScored) {
  if(input[index] === letter) {
    const scoredLetter = new Letter(letter, ColorsScore.Green, ColorsClass.Green);
    let nm = numScored.set(letter, (numScored.get(letter, 0)) + 1);
    keyboardScores$.next(scoredLetter);
    return new ResponseStatus(scoredLetter, nm);
  }
  else if(input.includes(letter)
      && sameOccurrencesFromLetter(input, response, letter)) {
    const scoredLetter = new Letter(letter, ColorsScore.Yellow, ColorsClass.Yellow);
    let nm = numScored.set(letter, (numScored.get(letter, 0)) + 1);
    keyboardScores$.next(scoredLetter);
    return new ResponseStatus(scoredLetter, nm);
  }
  else if(input.includes(letter)
      && numScored.get(letter, 0) < numOccurrences(input, letter)
      && !containLetterWithOrden(response, input, letter, index)) {
    const scoredLetter = new Letter(letter, ColorsScore.Yellow, ColorsClass.Yellow);
    let nm = numScored.set(letter, (numScored.get(letter,0)) + 1);
    keyboardScores$.next(scoredLetter);
    return new ResponseStatus(scoredLetter, nm);
  } else {
    const scoredLetter = new Letter(letter, ColorsScore.Grey, ColorsClass.Grey);
    keyboardScores$.next(scoredLetter);
    return new ResponseStatus(scoredLetter, numScored);
  }
}

function sameOccurrencesFromLetter(input, response, letter) {
  let count1 = (input.match(new RegExp(letter, "g")) || []).length;
  let count2 = (response.match(new RegExp(letter, "g")) || []).length;
  return count1 === count2;
}

function numOccurrences(response, letter) {
  return (response.match(new RegExp(letter, "g")) || []).length;
}

function containLetterWithOrden(response, input, letter, index) {
  return (response[index] === input[index]) && response[index] === letter
}

function createCumulativeResponseKey(letter) {
  return `
  <div class="key ${letter.colorClass}">
    ${letter.letter}
  </div>`
}

function initKeyboardEvents() {

  keyboardInputs$.pipe(
      scan((prev, cur) => generateCompleteInput(prev, cur)),
      map(response => response.length !== WORD_LENGTH)
  ).subscribe(
      (disabledButton) => sendResponseDom.disabled = disabledButton
  );

  fromEvent(deleteDom, 'click')
  .subscribe(() => keyboardInputs$.next(DELETE_KEY));

  fromEvent(sendResponseDom, 'click')
  .subscribe(() => keyboardInputs$.next(SEND_KEY));

  LETTERS.map(letter => {
    const letterDom = document.getElementById(letter)
    fromEvent(letterDom, 'click')
      .pipe(map(() => letterDom.innerText))
      .subscribe(x => keyboardInputs$.next(x))
  })
}

function generateCompleteInput(prev, cur) {
  if(cur === DELETE_KEY) return removeLastChar(prev);
  else if (cur === SEND_KEY) {
    return "";
  } else if (prev.length === WORD_LENGTH) return prev;
  else return prev + cur;
}