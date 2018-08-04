/**
 * Class to handle Add Review dialog 
 * Each time opens/closes its content is created/clered respecively
 */
export default class AddReviewModalHandler {
  constructor() {
    this.focusedBeforeModal = null;
    //modal overlay div contains modal div
    this.modalOverlay = document.getElementById('modal-background');
    this.modal = document.getElementById('modal');
  }

  close() {
    // Hide the modal and overlay
    this.modalOverlay.style.display = 'none';
    this.modal.style.display = 'none';

    let inputElements = this.modal.querySelectorAll('input:not([disabled]), textarea:not([disabled])');
    for(const input of inputElements) {
      input.value = "";
    }

    // Set focus back to element that had it before the modal was opened
    this.focusedBeforeModal.focus();
  }
  
  
  /**
   * Returns a Promise with 'true' value if closeOkElement was clicked, 
   * 'false' if closeCancelElement or backgound was clicked.
   * This method doesn't close a modal
   * @param {*} closeOkElement dom element to confirm an action 
   * @param {*} closeCancelElement dom element to close a dialog, optional
   */
  open() {
    // save current focus
    this.focusedBeforeModal = document.activeElement;

    // Find all focusable children
    const focusableElementsString = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]';
    let focusableElements = this.modal.querySelectorAll(focusableElementsString);
    // Convert NodeList to Array
    focusableElements = Array.prototype.slice.call(focusableElements);

    const firstTabStop = focusableElements[0];
    const lastTabStop = focusableElements[focusableElements.length - 1];

    // Show the modal and overlay
    this.modal.style.display = 'block';
    this.modalOverlay.style.display = 'block';

    // Focus first child
    firstTabStop.focus(); 
    
    const self = this;

    return new Promise (resolve =>  {

      const resolveCancel = () => {
        self.close();
        resolve(false);        
      };

      const resolveOK = () => {
        let inputElements = this.modal.querySelectorAll('input:not([disabled]), textarea:not([disabled])');
        const review = {};
        for(const input of inputElements) {
          review[input.name] = input.value;
        }
        self.close();       
        resolve(review);
      };

      const trapTabKey = (e) => {
        // Check for TAB key press
        if (e.keyCode === 9) {
  
          // SHIFT + TAB
          if (e.shiftKey) {
            if (document.activeElement === firstTabStop) {
              e.preventDefault();
              lastTabStop.focus();
            }
  
            // TAB
          } else {
            if (document.activeElement === lastTabStop) {
              e.preventDefault();
              firstTabStop.focus();
            }
          }
        }
  
        // ESCAPE
        if (e.keyCode === 27) {
          resolveCancel();
        }
      }


      // Listen for and trap the keyboard
      self.modal.addEventListener('keydown', trapTabKey);

      // Listen for indicators to close the modal
      self.modalOverlay.addEventListener('click', resolveCancel);

      const closeCancelElement = document.getElementById('cancel-button');
      if(closeCancelElement) {
        closeCancelElement.onclick = resolveCancel;
      }
      const closeOkElement = document.getElementById('add-review-button');
      if(closeOkElement) {
        closeOkElement.onclick = (event) => {
          const commentRegexp = /^[\w\-\s,\.!\(\):%"'&$]+$/;
          const textareas = this.modal.querySelectorAll('textarea:not([disabled])');
          let textAreasValid = false;
          for(const input of textareas) {
            textAreasValid = input.value ? commentRegexp.test(input.value) : true;
            input.className = textAreasValid ? 'valid' : 'invalid';
          }
          const formValid = this.modal.querySelector('form').checkValidity();
          //let the default validation work
          if(!formValid) return;

          //if textarea invalid - just ignore click
          if(!textAreasValid){
            event.preventDefault();
            return false;
          }
          //if forrm is valid - resolve a promise, otherwise let the default validation happen
          if(textAreasValid && formValid) {
            event.preventDefault();
            resolveOK();
            return false;
          }

        }
      }
    });
  }
}
