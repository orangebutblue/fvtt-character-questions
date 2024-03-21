class CharacterQuestions extends FormApplication {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "character-questions",
            title: "Character Questions",
            template: "modules/character-questions/templates/form.html",
            closeOnSubmit: true,
        });
    }

    getData() {
        // Retrieve the saved form data
        const formData = game.settings.get('character-questions', 'formData');

        // Set the selected state for each form field
        Object.keys(formData).forEach(key => {
            formData[key + 'Selected'] = formData[key];
        });

        // Set the value for numQuestions
        formData.numQuestions = formData.numQuestions || 1;

        return formData;
    }

    activateListeners(html) {
        super.activateListeners(html);
        // add event listeners to form elements
    }

    async _updateObject(event, formData) {
        let formObject = {};

        // Handle text fields and selects
        $(event.target).serializeArray().forEach(item => {
            formObject[item.name] = item.value;
        });

        // Handle checkboxes
        $(event.target).find('input[type="checkbox"]').each((_, element) => {
            formObject[element.name] = element.checked;
        });

        // Save the form data
        game.settings.set('character-questions', 'formData', formObject);

        const selectedCategories = Object.fromEntries(Object.entries(formData).filter(([key, value]) => value));
        let numQuestions = parseInt(formData.numQuestions) || 1;
        numQuestions = Math.max(Math.min(numQuestions, 10), 1);
        // console.log(selectedCategories);

        const selectedLanguage = formData.language || 'en';
        // TODO replace with cdn
        const jsonUrl = 'https://raw.githubusercontent.com/orangebutblue/CharacterQuestions/main/questions.json';

        try {
            const response = await fetch(jsonUrl);
            if (!response.ok) {
                throw new Error(`Error fetching JSON: ${response.statusText}`);
            }
            const data = await response.json();

            // Process the JSON data based on selected categories
            for (const category in selectedCategories) {
                if (data[category]) {
                    const items = data[category];
                    const gmIds = game.users.filter(user => user.isGM).map(gm => gm.id);
                    if (numQuestions > items.length) {
                        ChatMessage.create({
                            user: game.user._id,
                            whisper: gmIds,
                            content: `Warning: You've requested ${numQuestions} questions for <i>${category}</i>, but there are only ${items.length} questions available.`,
                        });
                    }
                    for (let i = 0; i < numQuestions; i++) {
                        const randomIndex = Math.floor(Math.random() * items.length);
                        // return english text if selectedLanguage not available
                        const randomItem = items[randomIndex][selectedLanguage] || items[randomIndex].en;
                        // Remove selection to prevent duplicate picks
                        items.splice(randomIndex, 1);
                        ChatMessage.create({
                            user: game.user._id,
                            whisper: gmIds,
                            content: `Question about <i>${category}</i>:<br/><b>${randomItem}</b>`,
                        });
                    }
                }
            }
        } catch (error) {
            console.error(error);
        }
    }
}


Hooks.on("getSceneControlButtons", (controls) => {
    if (game.user.isGM) {
        const newButton = {
            name: "character-question-button",
            title: "Character Questions",
            icon: "fa-solid fa-question",
            onClick: () => {
                new CharacterQuestions().render(true);
            },
            button: true
        };

        const tokenControls = controls.find((control) => control.name === "token");
        if (tokenControls) {
            tokenControls.tools.push(newButton);
        }
    }
});
Hooks.once('init', function () {
    game.settings.register('character-questions', 'formData', {
        name: 'Form Data',
        hint: 'Data from the form',
        scope: 'world', // specifies a world-level setting
        config: false, // specifies that the setting does not appear in the settings menu
        default: {},
        type: Object,
    });
    // Register Handlebars helper
    Handlebars.registerHelper('selected', function (value, expectedValue) {
        return value === expectedValue ? 'selected' : '';
    });
});
