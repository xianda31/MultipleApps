/**
 * Patch for EditorJS LinkTool to allow relative URLs
 * Usage: pass this as the LinkTool class in EditorJS config
 */
class LinkToolRelative {
  static get toolbox() {
    return {
      title: 'Link',
      icon: '<svg width="17" height="17"><path d="M7.5 1.5h2a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4v-2a4 4 0 0 1 4-4z" fill="none" stroke="#000"/></svg>'
    };
  }

  constructor({data}) {
    this.data = data;
  }

  render() {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter a link';
    input.value = this.data && this.data.link ? this.data.link : '';
    input.addEventListener('input', (e) => {
      this.data.link = e.target.value;
    });
    return input;
  }

  save(blockContent) {
    return {
      link: blockContent.value
    };
  }

  validate(savedData) {
    // Accept relative links (start with / or ./ or ../)
    if (!savedData.link) return false;
    return /^([a-zA-Z]+:\/\/|\/|\.\/|\.\.\/)/.test(savedData.link);
  }
}

window.LinkToolRelative = LinkToolRelative;
