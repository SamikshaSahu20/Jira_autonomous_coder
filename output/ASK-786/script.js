class Calculator {
  constructor(displayElement) {
    this.displayElement = displayElement;
    this.clear();
  }

  clear() {
    this.currentOperand = '';
    this.previousOperand = '';
    this.operation = undefined;
    this.updateDisplay();
  }

  appendNumber(number) {
    if (number === '.' && this.currentOperand.includes('.')) return;
    this.currentOperand = this.currentOperand.toString() + number.toString();
    this.updateDisplay();
  }

  chooseOperation(operation) {
    if (this.currentOperand === '') return;
    if (this.previousOperand !== '') {
      this.compute();
    }
    this.operation = operation;
    this.previousOperand = this.currentOperand;
    this.currentOperand = '';
    this.updateDisplay();
  }

  compute() {
    const prev = parseFloat(this.previousOperand);
    const current = parseFloat(this.currentOperand);

    if (isNaN(prev) || isNaN(current)) return;

    const operations = {
      '+': (a, b) => a + b,
      '-': (a, b) => a - b,
      '*': (a, b) => a * b,
      '/': (a, b) => (b === 0 ? 'Error' : a / b),
    };

    const computation = operations[this.operation];
    if (!computation) return;

    const result = computation(prev, current);
    if (result === 'Error') {
      this.currentOperand = 'Error';
    } else {
      this.currentOperand = result;
    }
    this.operation = undefined;
    this.previousOperand = '';
    this.updateDisplay();
  }

  updateDisplay() {
    this.displayElement.textContent = this.currentOperand || '0';
  }
}

const displayElement = document.querySelector('#display');
const calculator = new Calculator(displayElement);

document.querySelectorAll('.digit').forEach(button =>
  button.addEventListener('click', () => {
    calculator.appendNumber(button.dataset.value);
  })
);

document.querySelectorAll('.operation').forEach(button =>
  button.addEventListener('click', () => {
    calculator.chooseOperation(button.dataset.value);
  })
);

document.querySelector('#equals').addEventListener('click', () => {
  calculator.compute();
});

document.querySelector('#clear').addEventListener('click', () => {
  calculator.clear();
});