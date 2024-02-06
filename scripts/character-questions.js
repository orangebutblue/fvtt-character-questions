class CharacterQuestions extends FormApplication {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "character-questions",
            title: "Character Questions",
            template: "modules/character-questions/templates/form.html",
            closeOnSubmit: false,
        });
    }

    getData() {
        // TODO pass data to form
        return {};
    }

    activateListeners(html) {
        super.activateListeners(html);
        // add event listeners to form elements
    }

    async _updateObject(event, formData) {
        // handle form submission

        const selectedCategories = Object.fromEntries(Object.entries(formData).filter(([key, value]) => value));
        let numQuestions = parseInt(formData.numQuestions) || 1;
        numQuestions = Math.max(Math.min(numQuestions, 10), 1);
        // console.log(selectedCategories);

        // replace with cdn
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

                    for (let i = 0; i < numQuestions; i++) {
                        const randomItem = items[Math.floor(Math.random() * items.length)];
                        // TODO remove  selected item from the array to prevent duplicates
                        console.log(`Random item from ${category}: ${randomItem}`);
                        ChatMessage.create({
                            user: game.user._id,
                            whisper: gmIds,
                            content: `"${category}" question:<br/>${randomItem}`,
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
    const newButton = {
        name: "character-question-button",
        title: "Character Questions",
        icon: "fa-solid fa-question",
        onClick: () => {
            new CharacterQuestions().render(true);
        },
        button: true
    };

    // place where to add the button to
    const tokenControls = controls.find((control) => control.name === "token");
    if (tokenControls) {
        tokenControls.tools.push(newButton);
    }
});
