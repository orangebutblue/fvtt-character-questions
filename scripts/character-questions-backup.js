/**
 * Character Questions Module
 * Main module initialization and hook registration
 */

// Module constants
const MODULE_ID = "fvtt-character-questions";
const MODULE_VERSION = "0.1.1";

// Global module state
let debugLogger = null;

/**
 * Character Questions Form Application
 */
class CharacterQuestions extends FormApplication {
    constructor(options = {}) {
        super(options);
    }

    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            id: "character-questions",
            title: "Character Questions",
            template: `modules/${MODULE_ID}/templates/form.html`,
            closeOnSubmit: true,
        };
    }

    getData() {
        const formData = game.settings.get(MODULE_ID, 'formData');
        Object.keys(formData).forEach(key => {
            formData[key + 'Selected'] = formData[key];
        });
        formData.numQuestions = formData.numQuestions || 1;
        return formData;
    }

    activateListeners(html) {
        super.activateListeners(html);
    }

    async _updateObject(event, formData) {
        let formObject = {};
        $(event.target).serializeArray().forEach(item => {
            formObject[item.name] = item.value;
        });
        $(event.target).find('input[type="checkbox"]').each((_, element) => {
            formObject[element.name] = element.checked;
        });
        game.settings.set(MODULE_ID, 'formData', formObject);

        const categories = ['background', 'motivations', 'personality', 'values', 'relationships', 'secrets', 'weakness', 'interests', 'society'];
        const selectedCategories = Object.fromEntries(
            Object.entries(formData).filter(([key, value]) => categories.includes(key) && value)
        );
        let numQuestions = parseInt(formData.numQuestions) || 1;
        numQuestions = Math.max(Math.min(numQuestions, 10), 1);
        const selectedLanguage = formData.language || 'en';
        const jsonUrl = 'https://raw.githubusercontent.com/orangebutblue/CharacterQuestions/main/questions.json';

        try {
            const response = await fetch(jsonUrl);
            if (!response.ok) {
                throw new Error(`Error fetching JSON: ${response.statusText}`);
            }
            const data = await response.json();

            for (const category in selectedCategories) {
                if (data[category]) {
                    const items = data[category];
                    const gmIds = game.users.filter(user => user.isGM).map(gm => gm.id);
                    if (numQuestions > items.length) {
                        ChatMessage.create({
                            user: game.user.id,
                            whisper: gmIds,
                            content: `Warning: You've requested ${numQuestions} questions for <i>${category}</i>, but there are only ${items.length} questions available.`,
                        });
                    }
                    for (let i = 0; i < numQuestions; i++) {
                        const randomIndex = Math.floor(Math.random() * items.length);
                        const randomItem = items[randomIndex][selectedLanguage] || items[randomIndex].en;
                        items.splice(randomIndex, 1);
                        ChatMessage.create({
                            user: game.user.id,
                            whisper: gmIds,
                            content: `Question about <i>${category}</i>:<br/><b>${randomItem}</b>`,
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Character Questions | Error in question generation:', error);
            ui.notifications.error('Error generating questions. Check console for details.');
        }
    }
}

// Module initialization
Hooks.once('init', () => {
    console.log('Character Questions | Initializing module');

    // Register Handlebars helpers
    registerHandlebarsHelpers();

    // Register module settings
    registerModuleSettings();

    console.log('Character Questions | Module initialized');
});

// Ready hook - module fully loaded
Hooks.once('ready', async () => {
    console.log('Character Questions | Module ready');

    try {
        // Initialize native UI integration
        await initializeProperSceneControls();

        console.log('Character Questions | Setup complete');

    } catch (error) {
        console.error('Character Questions | Setup failed:', error);
        ui.notifications.error(`Character Questions setup failed: ${error.message}`);
    }
});

/**
 * Register Handlebars helpers for templates
 */
function registerHandlebarsHelpers() {
    // Register selected helper for form selects
    Handlebars.registerHelper('selected', function (value, expectedValue) {
        return value === expectedValue ? 'selected' : '';
    });

        console.log('Character Questions | Handlebars helpers registered');
}

/**
 * Register module settings with FoundryVTT
 */
function registerModuleSettings() {
    // Form data setting
    game.settings.register(MODULE_ID, 'formData', {
        name: 'Form Data',
        hint: 'Data from the form',
        scope: 'world',
        config: false,
        default: {},
        type: Object,
    });

    console.log('Character Questions | Settings registered');
}

/**
 * Initialize proper scene controls integration ONLY
 */
async function initializeProperSceneControls() {
    const setting = game.settings.settings.get('trading-places', 'activeDataset');
    if (setting) {
        setting.choices = getAvailableDatasets();
        // Force Foundry to re-render the settings UI
        if (game.settings.sheet) {
            game.settings.sheet.render();
        }
    }
}

// Make it globally available
window.refreshTradingPlacesDatasetChoices = refreshDatasetChoices;

/**
 * Register module settings with FoundryVTT
 */
function registerModuleSettings() {
    // Register all module settings using our new system
    TradingPlacesSettings.registerSettings();
    
    // Register user datasets setting first (needed by getAvailableDatasets)
    game.settings.register(MODULE_ID, "userDatasets", {
        name: "User Datasets",
        hint: "List of user-created datasets",
        scope: "world",
        config: false,
        type: Array,
        default: []
    });

    // Active dataset setting - now with dynamic choices
    game.settings.register(MODULE_ID, "activeDataset", {
        name: "TRADING-PLACES.Settings.ActiveDataset.Name",
        hint: "TRADING-PLACES.Settings.ActiveDataset.Hint",
        scope: "world",
        config: true,
        type: String,
        default: "wfrp4e",
        choices: getAvailableDatasets,
        onChange: onActiveDatasetChange
    });

    // Current season setting
    game.settings.register(MODULE_ID, "currentSeason", {
        name: "TRADING-PLACES.Settings.CurrentSeason.Name",
        hint: "TRADING-PLACES.Settings.CurrentSeason.Hint",
        scope: "world",
        config: false, // Hidden from settings
        type: String,
        choices: {
            "spring": "TRADING-PLACES.Seasons.Spring",
            "summer": "TRADING-PLACES.Seasons.Summer",
            "autumn": "TRADING-PLACES.Seasons.Autumn",
            "winter": "TRADING-PLACES.Seasons.Winter"
        },
        default: "spring",
        onChange: onCurrentSeasonChange
    });

    // Chat visibility setting
    game.settings.register(MODULE_ID, "chatVisibility", {
        name: "TRADING-PLACES.Settings.ChatVisibility.Name",
        hint: "TRADING-PLACES.Settings.ChatVisibility.Hint",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "gm": "TRADING-PLACES.Settings.ChatVisibility.GM",
            "all": "TRADING-PLACES.Settings.ChatVisibility.All"
        },
        default: "gm",
        onChange: onChatVisibilityChange
    });

    // Module version setting (for migration tracking)
    game.settings.register(MODULE_ID, "moduleVersion", {
        name: "Module Version",
        hint: "Internal setting for tracking module version",
        scope: "world",
        config: false,
        type: String,
        default: "0.0.0"
    });

    // Last dataset validation setting
    game.settings.register(MODULE_ID, "lastDatasetValidation", {
        name: "Last Dataset Validation",
        hint: "Internal setting for tracking dataset validation",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    // Window state setting for V2 Application
    game.settings.register(MODULE_ID, "windowState", {
        name: "Window State",
        hint: "Stores window position and size for the trading interface",
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });

    // Enable debug logging setting
    game.settings.register(MODULE_ID, "debugLogging", {
        name: "TRADING-PLACES.Settings.DebugLogging.Name",
        hint: "TRADING-PLACES.Settings.DebugLogging.Hint",
        scope: "world",
        config: false, // Hidden from settings
        type: Boolean,
        default: false,
        onChange: onDebugLoggingChange
    });

    // Selected region setting (for persistence)
    game.settings.register(MODULE_ID, "selectedRegion", {
        name: "Selected Region",
        hint: "Stores the last selected region in the trading interface",
        scope: "client",
        config: false,
        type: String,
        default: ""
    });

    // Selected settlement setting (for persistence)
    game.settings.register(MODULE_ID, "selectedSettlement", {
        name: "Selected Settlement",
        hint: "Stores the last selected settlement in the trading interface",
        scope: "client",
        config: false,
        type: String,
        default: ""
    });

    // Cargo availability data setting (for persistence)
    game.settings.register(MODULE_ID, "cargoAvailabilityData", {
        name: "Cargo Availability Data",
        hint: "Stores cargo availability data for all settlements and seasons",
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });

    // Seller offers data setting (for persistence)
    game.settings.register(MODULE_ID, "sellerOffersData", {
        name: "Seller Offers Data",
        hint: "Stores seller offers data for all settlements and seasons",
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });

    // Transaction history setting (for persistence)
    game.settings.register(MODULE_ID, "transactionHistory", {
        name: "Transaction History",
        hint: "Stores trading transaction history for persistence across sessions",
        scope: "world",
        config: false,
        type: Array,
        default: []
    });

    // Cargo capacity setting
    game.settings.register(MODULE_ID, "cargoCapacity", {
        name: "Cargo Capacity",
        hint: "Maximum cargo capacity in EP that players can carry",
        scope: "world",
        config: false,
        type: Number,
        default: 400
    });
}

/**
 * Register settings change handlers
 */
function registerSettingsChangeHandlers() {
    // Additional setup for change handlers if needed
    console.log('Trading Places | Settings change handlers registered');

    // Hook to add dataset management buttons to settings
    Hooks.on('renderSettingsConfig', (app, html, data) => {
        console.log('Trading Places | renderSettingsConfig hook fired', { app, html, data });

        // Only add buttons for GMs
        if (!game.user.isGM) {
            console.log('Trading Places | Not GM, skipping dataset management buttons');
            return;
        }

        // Find the activeDataset setting row
        const $html = $(html);
        console.log('Trading Places | Looking for activeDataset setting...');

        // Try different selectors for Foundry v13
        let activeDatasetRow = $html.find('[data-setting-id="trading-places.activeDataset"]').closest('.form-group');
        if (!activeDatasetRow.length) {
            console.log('Trading Places | Primary selector failed, trying alternatives...');
            // Try alternative selectors
            activeDatasetRow = $html.find('select[name="trading-places.activeDataset"]').closest('.form-group');
        }
        if (!activeDatasetRow.length) {
            console.log('Trading Places | Alternative selector failed, trying broader search...');
            // Try finding any trading-places setting
            activeDatasetRow = $html.find('[data-setting-id*="trading-places"]').closest('.form-group').first();
        }

        console.log('Trading Places | Found activeDataset row:', activeDatasetRow.length, activeDatasetRow);

        if (!activeDatasetRow.length) {
            console.log('Trading Places | Could not find activeDataset setting row, available settings:', $html.find('[data-setting-id]').map((i, el) => $(el).attr('data-setting-id')).get());
            return;
        }

        console.log('Trading Places | Adding dataset management buttons...');

        // Add buttons after the activeDataset setting
        const buttonsHtml = `
            <div class="form-group dataset-management-buttons" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                <label>Dataset Management</label>
                <div class="form-fields">
                    <button type="button" class="add-dataset-btn" style="margin-right: 10px;">
                        <i class="fas fa-plus"></i>
                        Add Dataset
                    </button>
                    <button type="button" class="delete-dataset-btn">
                        <i class="fas fa-trash"></i>
                        Delete Selected Dataset
                    </button>
                </div>
                <p class="notes">Add new datasets or delete the currently selected dataset. Built-in datasets cannot be deleted.</p>
            </div>
        `;

        activeDatasetRow.after(buttonsHtml);
        console.log('Trading Places | Dataset management buttons added');

        // Add event listeners to the buttons
        $html.find('.add-dataset-btn').on('click', (event) => {
            event.preventDefault();
            console.log('Trading Places | Add dataset button clicked');
            handleCreateDataset();
        });

        $html.find('.delete-dataset-btn').on('click', (event) => {
            event.preventDefault();
            console.log('Trading Places | Delete dataset button clicked');
            handleDeleteDataset();
        });

        console.log('Trading Places | Event listeners attached');
    });
}

/**
 * Handle create dataset button click in settings
 */
async function handleCreateDataset() {
    const content = `
        <div class="dataset-create-dialog">
            <p>Enter a name for the new dataset:</p>
            <input type="text" id="new-dataset-name" placeholder="e.g., my-custom-dataset" style="width: 100%; padding: 8px; margin: 10px 0;">
            <p><small>The dataset will be created with empty JSON files that you can populate through the Data Management interface.</small></p>
        </div>
    `;

    Dialog.confirm({
        title: 'Create New Dataset',
        content: content,
        yes: async (html) => {
            const datasetName = html.find('#new-dataset-name').val().trim();

            if (!datasetName) {
                ui.notifications.error('Dataset name cannot be empty');
                return;
            }

            if (!/^[a-zA-Z0-9_-]+$/.test(datasetName)) {
                ui.notifications.error('Dataset name can only contain letters, numbers, hyphens, and underscores');
                return;
            }

            // Check if dataset already exists
            const existingDatasets = game.settings.get('trading-places', 'userDatasets') || [];
            if (existingDatasets.includes(datasetName)) {
                ui.notifications.error('A dataset with this name already exists');
                return;
            }

            try {
                // Create the dataset
                await createDataset(datasetName);

                // Add to user datasets list
                existingDatasets.push(datasetName);
                await game.settings.set('trading-places', 'userDatasets', existingDatasets);

                ui.notifications.info(`Dataset "${datasetName}" created successfully`);

                // Refresh the settings page to show the new dataset in the dropdown
                // Instead of reloading, we'll update the select element directly
                const selectElement = document.querySelector('select[name="trading-places.activeDataset"]');
                if (selectElement) {
                    // Clear existing options
                    selectElement.innerHTML = '';
                    
                    // Get updated choices
                    const choices = getAvailableDatasets();
                    
                    // Add new options
                    Object.entries(choices).forEach(([value, label]) => {
                        const option = document.createElement('option');
                        option.value = value;
                        option.textContent = label;
                        if (value === datasetName) {
                            option.selected = true;
                        }
                        selectElement.appendChild(option);
                    });
                    
                    // Trigger change event to update the setting
                    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                }

            } catch (error) {
                ui.notifications.error(`Failed to create dataset: ${error.message}`);
                console.error('Dataset creation error:', error);
            }
        },
        no: () => {}
    });
}

/**
 * Handle delete dataset button click in settings
 */
async function handleDeleteDataset() {
    const currentDataset = game.settings.get('trading-places', 'activeDataset');
    const availableDatasets = getAvailableDatasets();

    // Filter to only user datasets (exclude built-in)
    const userDatasets = Object.keys(availableDatasets).filter(key =>
        availableDatasets[key].includes('(User)')
    );

    if (userDatasets.length === 0) {
        ui.notifications.warn('No user-created datasets to delete');
        return;
    }

    let datasetToDelete = null;

    if (userDatasets.length === 1) {
        datasetToDelete = userDatasets[0];
    } else {
        // Create a select dropdown for multiple datasets
        const options = userDatasets.map(name =>
            `<option value="${name}" ${name === currentDataset ? 'selected' : ''}>${name}</option>`
        ).join('');

        const content = `
            <div class="dataset-delete-dialog">
                <p>Select the dataset to delete:</p>
                <select id="dataset-to-delete" style="width: 100%; padding: 8px; margin: 10px 0;">
                    ${options}
                </select>
                <p style="color: #ff6b6b;"><strong>Warning:</strong> This action cannot be undone. The dataset files will be permanently deleted.</p>
            </div>
        `;

        await new Promise((resolve) => {
            Dialog.confirm({
                title: 'Delete Dataset',
                content: content,
                yes: (html) => {
                    datasetToDelete = html.find('#dataset-to-delete').val();
                    resolve();
                },
                no: () => resolve(null)
            });
        });
    }

    if (!datasetToDelete) return;

    // Confirm deletion
    const confirmContent = `
        <p>Are you sure you want to delete the dataset "${datasetToDelete}"?</p>
        <p style="color: #ff6b6b;"><strong>This action cannot be undone.</strong></p>
        ${datasetToDelete === currentDataset ? '<p style="color: #ffa500;">Note: This is your currently active dataset. It will be deleted but remain selected until you choose another dataset.</p>' : ''}
    `;

    Dialog.confirm({
        title: 'Confirm Dataset Deletion',
        content: confirmContent,
        yes: async () => {
            try {
                // Delete the dataset
                await deleteDataset(datasetToDelete);

                // Remove from user datasets list
                const userDatasets = game.settings.get('trading-places', 'userDatasets') || [];
                const updatedList = userDatasets.filter(name => name !== datasetToDelete);
                await game.settings.set('trading-places', 'userDatasets', updatedList);

                ui.notifications.info(`Dataset "${datasetToDelete}" deleted successfully`);

                // Refresh the settings page to update the dropdown
                const selectElement = document.querySelector('select[name="trading-places.activeDataset"]');
                if (selectElement) {
                    // Clear existing options
                    selectElement.innerHTML = '';
                    
                    // Get updated choices
                    const choices = getAvailableDatasets();
                    
                    // Add remaining options
                    Object.entries(choices).forEach(([value, label]) => {
                        const option = document.createElement('option');
                        option.value = value;
                        option.textContent = label;
                        selectElement.appendChild(option);
                    });
                    
                    // If the deleted dataset was selected, switch to default
                    if (selectElement.value === datasetToDelete || !selectElement.value) {
                        selectElement.value = 'wfrp4e';
                        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }

            } catch (error) {
                ui.notifications.error(`Failed to delete dataset: ${error.message}`);
                console.error('Dataset deletion error:', error);
            }
        },
        no: () => {}
    });
}

/**
 * Create a new dataset with empty JSON files
 */
async function createDataset(datasetName) {
    // Get current user datasets list and add the new one
    const userDatasets = game.settings.get('trading-places', 'userDatasets') || [];
    if (!userDatasets.includes(datasetName)) {
        userDatasets.push(datasetName);
        await game.settings.set('trading-places', 'userDatasets', userDatasets);
    }

    // Store placeholder data in game settings for now
    const placeholderData = {
        settlements: [{
            name: "Example Settlement",
            region: "Example Region",
            size: 3,
            wealth: 3,
            population: 1000,
            ruler: "Local Authority",
            notes: "This is a placeholder settlement. Edit it using the Data Management interface.",
            produces: [],
            demands: [],
            flags: []
        }],
        cargoTypes: [{
            name: "Example Cargo",
            category: "Trade Goods",
            basePrice: 100,
            description: "This is a placeholder cargo type. Edit it using the Data Management interface.",
            seasonalModifiers: {
                spring: 1.0,
                summer: 1.0,
                autumn: 1.0,
                winter: 1.0
            }
        }],
        config: {
            "system": "wfrp4e",
            "version": "1.0",
            "currency": {
                "primary": "Gold Crown",
                "secondary": "Silver Shilling",
                "tertiary": "Brass Penny",
                "rates": {
                    "Gold Crown": 240,
                    "Silver Shilling": 12,
                    "Brass Penny": 1
                }
            }
        },
        tradingConfig: {
            "cargoSlots": {
                "basePerSize": {
                    "1": 1,
                    "2": 2,
                    "3": 3,
                    "4": 4,
                    "5": 5
                },
                "populationMultiplier": 0.001,
                "sizeMultiplier": 0.5,
                "hardCap": 20,
                "flagMultipliers": {}
            }
        }
    };

    await game.settings.set('trading-places', `userDataset_${datasetName}`, placeholderData);

    ui.notifications.info(`Dataset "${datasetName}" created with placeholder data. Use the Data Management interface to edit settlements and cargo types.`);

    console.log(`Trading Places | Created user dataset: ${datasetName} with placeholder data`);

    return true;
}

/**
 * Delete a dataset and its files
 */
async function deleteDataset(datasetName) {
    // Check if it's a built-in dataset (shouldn't happen, but safety check)
    if (datasetName === 'wfrp4e') {
        ui.notifications.error('Cannot delete built-in datasets');
        return false;
    }

    try {
        // Get current user datasets list
        const userDatasets = game.settings.get('trading-places', 'userDatasets') || [];

        // Remove the dataset from the list
        const updatedDatasets = userDatasets.filter(name => name !== datasetName);

        // Update the user datasets list
        await game.settings.set('trading-places', 'userDatasets', updatedDatasets);

        // Remove the dataset data
        await game.settings.set('trading-places', `userDataset_${datasetName}`, null);

        ui.notifications.info(`Dataset "${datasetName}" deleted successfully`);
        console.log(`Trading Places | Deleted user dataset: ${datasetName}`);

        return true;
    } catch (error) {
        console.error('Trading Places | Dataset deletion error:', error);
        ui.notifications.error(`Failed to delete dataset: ${error.message}`);
        return false;
    }
}
async function onActiveDatasetChange(newValue) {
    console.log(`Trading Places | Active dataset changed to: ${newValue}`);

    try {
        // Validate new dataset exists
        const validation = await validateDatasetExists(newValue);
        if (!validation.valid) {
            ui.notifications.error(`Dataset validation failed: ${validation.errors.join(', ')}`);
            return;
        }

        // Reload dataset
        if (dataManager) {
            await dataManager.switchDataset(newValue);
            ui.notifications.info(`Switched to dataset: ${newValue}`);
        }

        // Update last validation timestamp
        await game.settings.set(MODULE_ID, "lastDatasetValidation", new Date().toISOString());

    } catch (error) {
        console.error('Trading Places | Dataset change failed:', error);
        ui.notifications.error(`Failed to switch dataset: ${error.message}`);
    }
}

/**
 * Handle current season setting change
 * @param {string} newValue - New season name
 */
async function onCurrentSeasonChange(newValue) {
    console.log(`Trading Places | Current season changed to: ${newValue}`);

    try {
        // Validate season value
        const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
        if (!validSeasons.includes(newValue)) {
            ui.notifications.error(`Invalid season: ${newValue}`);
            return;
        }

        // Update trading engine if initialized
        if (tradingEngine) {
            tradingEngine.setCurrentSeason(newValue);
        }

        // Note: Season change notification handled by application, not here to avoid duplicates

        // Post chat message about season change
        if (typeof ChatMessage !== 'undefined') {
            await ChatMessage.create({
                content: `<div class="season-change"><h3>Season Changed</h3><p>Trading season is now <strong>${newValue}</strong>. All cargo prices have been updated accordingly.</p></div>`,
                whisper: game.settings.get(MODULE_ID, "chatVisibility") === "gm" ? [game.user.id] : null
            });
        }

    } catch (error) {
        console.error('Trading Places | Season change failed:', error);
        ui.notifications.error(`Failed to change season: ${error.message}`);
    }
}

/**
 * Handle chat visibility setting change
 * @param {string} newValue - New visibility setting
 */
async function onChatVisibilityChange(newValue) {
    console.log(`Trading Places | Chat visibility changed to: ${newValue}`);

    const validValues = ['gm', 'all'];
    if (!validValues.includes(newValue)) {
        ui.notifications.error(`Invalid chat visibility setting: ${newValue}`);
        return;
    }

    ui.notifications.info(`Chat visibility set to: ${newValue === 'gm' ? 'GM Only' : 'All Players'}`);
}

/**
 * Handle debug logging setting change
 * @param {boolean} newValue - New debug logging setting
 */
async function onDebugLoggingChange(newValue) {
    console.log(`Trading Places | Debug logging ${newValue ? 'enabled' : 'disabled'}`);

    // Update logger if it exists
    if (debugLogger) {
        debugLogger.setEnabled(newValue);
    }
    
    // Update global logger if it exists
    if (window.TPMLogger) {
        window.TPMLogger.setEnabled(newValue);
    }

    if (newValue) {
        ui.notifications.info('Debug logging enabled for Trading Places');
    }
}

/**
 * Perform settings migration if needed
 */
async function performSettingsMigration() {
    const currentVersion = game.settings.get(MODULE_ID, "moduleVersion");

    if (currentVersion === MODULE_VERSION) {
        return; // No migration needed
    }

    console.log(`Trading Places | Migrating from version ${currentVersion} to ${MODULE_VERSION}`);

    try {
        // Migration logic based on version
        if (currentVersion === "0.0.0") {
            // First time setup
            await performFirstTimeSetup();
        } else {
            // Version-specific migrations
            await performVersionMigration(currentVersion, MODULE_VERSION);
        }

        // Update version setting
        await game.settings.set(MODULE_ID, "moduleVersion", MODULE_VERSION);

        console.log('Trading Places | Migration completed successfully');

    } catch (error) {
        console.error('Trading Places | Migration failed:', error);
        ui.notifications.error(`Migration failed: ${error.message}`);
        throw error;
    }
}

/**
 * Perform first time setup
 */
async function performFirstTimeSetup() {
    console.log('Trading Places | Performing first time setup');

    // Set default values if not already set
    const currentSeason = game.settings.get(MODULE_ID, "currentSeason");
    if (!currentSeason) {
        await game.settings.set(MODULE_ID, "currentSeason", "spring");
    }

    const activeDataset = game.settings.get(MODULE_ID, "activeDataset");
    if (!activeDataset) {
        await game.settings.set(MODULE_ID, "activeDataset", "wfrp4e");
    }

    // Welcome message
    ui.notifications.info('Welcome to Trading Places! Check the module settings to configure your trading system.');
}

/**
 * Perform version-specific migration
 * @param {string} fromVersion - Previous version
 * @param {string} toVersion - Target version
 */
async function performVersionMigration(fromVersion, toVersion) {
    console.log(`Trading Places | Migrating from ${fromVersion} to ${toVersion}`);

    // Add version-specific migration logic here
    // For example:
    // if (fromVersion < "1.0.0") {
    //     await migrateToV1();
    // }
}

/**
 * Validate that a dataset exists
 * @param {string} datasetName - Name of dataset to validate
 * @returns {Object} - Validation result
 */
async function validateDatasetExists(datasetName) {
    try {
        // Check if dataset directory exists
        const datasetPath = `modules/${MODULE_ID}/datasets/${datasetName}`;

        // For now, assume dataset is valid if name is provided
        // In a real implementation, you would check file system
        const validDatasets = ['wfrp4e', 'custom'];

        if (!validDatasets.includes(datasetName)) {
            return {
                valid: false,
                errors: [`Dataset '${datasetName}' not found. Available datasets: ${validDatasets.join(', ')}`]
            };
        }

        return {
            valid: true,
            errors: []
        };

    } catch (error) {
        return {
            valid: false,
            errors: [error.message]
        };
    }
}

/**
 * Show validation error dialog with recovery options
 * @param {Object} validationResult - Validation result object
 * @param {Object} recoveryProcedures - Recovery procedures object
 */
async function showValidationErrorDialog(validationResult, recoveryProcedures) {
    const content = `
        <div class="validation-error-dialog">
            <h3>Configuration Validation Failed</h3>
            <p><strong>${validationResult.errors.length} error(s) found:</strong></p>
            <ul>
                ${validationResult.errors.slice(0, 5).map(error => `<li>${error}</li>`).join('')}
                ${validationResult.errors.length > 5 ? `<li><em>... and ${validationResult.errors.length - 5} more errors</em></li>` : ''}
            </ul>
            
            ${validationResult.warnings.length > 0 ? `
                <p><strong>${validationResult.warnings.length} warning(s):</strong></p>
                <ul>
                    ${validationResult.warnings.slice(0, 3).map(warning => `<li>${warning}</li>`).join('')}
                    ${validationResult.warnings.length > 3 ? `<li><em>... and ${validationResult.warnings.length - 3} more warnings</em></li>` : ''}
                </ul>
            ` : ''}
            
            <h4>Recommended Actions:</h4>
            <ol>
                ${recoveryProcedures.general.slice(0, 3).map(step => `<li>${step}</li>`).join('')}
            </ol>
            
            <p><em>Check the browser console for a detailed diagnostic report.</em></p>
        </div>
    `;

    return new Promise((resolve) => {
        if (typeof WFRPConfigErrorDialog !== 'undefined') {
            WFRPConfigErrorDialog.show(validationResult, recoveryProcedures).then(() => resolve());
        } else {
            // Fallback to notification
            ui.notifications.error(`Configuration validation failed with ${validationResult.errors.length} errors. Check console for details.`);
            console.error('Trading Places | Validation errors:', validationResult.errors);
            resolve();
        }
    });
}

/**
 * Initialize core components with error handling
 */
async function initializeCoreComponents() {
    console.log('Trading Places | Initializing core components');

    try {
        // Initialize DataManager
        dataManager = new DataManager();
        dataManager.setModuleId(MODULE_ID);
        
        // Expose DataManager globally for Data Management UI
        window.TradingPlacesDataManager = dataManager;
        
        console.log('Trading Places | DataManager initialized');

        // Initialize SystemAdapter
        systemAdapter = new SystemAdapter();

        // Connect error handler
        if (errorHandler) {
            systemAdapter.setErrorHandler(errorHandler);
        }

        // Validate system compatibility
        const systemValidation = systemAdapter.validateSystemCompatibility();
        if (!systemValidation.compatible) {
            const errorMessage = `System compatibility issues: ${systemValidation.errors.join(', ')}`;
            if (errorHandler) {
                errorHandler.handleTradingEngineError(new Error(errorMessage), 'SystemAdapter initialization');
            }
            // Continue with warnings but don't fail completely
            console.warn('Trading Places | System compatibility warnings:', systemValidation.warnings);
        }

        console.log('Trading Places | SystemAdapter initialized');

        // Initialize TradingEngine
        if (dataManager) {
            tradingEngine = new TradingEngine(dataManager);

            // Set current season with error handling
            try {
                const currentSeason = game.settings.get(MODULE_ID, "currentSeason");
                if (currentSeason) {
                    tradingEngine.setCurrentSeason(currentSeason);
                } else {
                    // Set default season
                    await game.settings.set(MODULE_ID, "currentSeason", "spring");
                    tradingEngine.setCurrentSeason("spring");
                    console.log('Trading Places | Set default season to spring');
                }
            } catch (seasonError) {
                if (errorHandler) {
                    errorHandler.handleTradingEngineError(seasonError, 'Season initialization');
                }
                // Use fallback season
                tradingEngine.setCurrentSeason("spring");
            }

            console.log('Trading Places | TradingEngine initialized');
        } else {
            throw new Error('DataManager required for TradingEngine initialization');
        }

        console.log('Trading Places | Core components initialized successfully');

    } catch (error) {
        console.error('Trading Places | Component initialization failed:', error);

        if (errorHandler) {
            errorHandler.handleDataLoadingError(error, 'Core Components', 'initialization');
        }

        throw error;
    }
}

/**
 * Load active dataset with comprehensive error handling
 */
async function loadActiveDataset() {
    console.log('Trading Places | Loading active dataset');

    try {
        if (!dataManager) {
            throw new Error('DataManager not initialized');
        }

        const activeDataset = game.settings.get(MODULE_ID, "activeDataset") || "wfrp4e";

        try {
            await dataManager.loadActiveDataset();
            console.log(`Trading Places | Successfully loaded dataset: ${activeDataset}`);

            // Validate loaded data
            const validation = dataManager.validateDatasetCompleteness({
                settlements: dataManager.settlements,
                config: dataManager.config
            });

            if (!validation.valid) {
                const warningMessage = `Dataset validation warnings: ${validation.errors.join(', ')}`;
                if (errorHandler) {
                    errorHandler.notifyUser('warning', warningMessage);
                }
                console.warn('Trading Places | Dataset validation warnings:', validation.errors);
            }

        } catch (datasetError) {
            // Try fallback to default dataset
            if (activeDataset !== "wfrp4e") {
                console.warn(`Trading Places | Failed to load ${activeDataset}, trying default dataset`);

                try {
                    await dataManager.switchDataset("wfrp4e");
                    await game.settings.set(MODULE_ID, "activeDataset", "wfrp4e");

                    if (errorHandler) {
                        errorHandler.notifyUser('warning', `Failed to load dataset '${activeDataset}', switched to default dataset`);
                    }

                    console.log('Trading Places | Successfully loaded default dataset as fallback');

                } catch (fallbackError) {
                    // Both datasets failed
                    if (errorHandler) {
                        errorHandler.handleDataLoadingError(fallbackError, 'Dataset', 'fallback loading');
                    }
                    throw new Error(`Failed to load both active dataset '${activeDataset}' and default dataset: ${fallbackError.message}`);
                }
            } else {
                // Default dataset failed
                if (errorHandler) {
                    errorHandler.handleDataLoadingError(datasetError, 'Default Dataset', 'loading');
                }
                throw datasetError;
            }
        }

    } catch (error) {
        console.error('Trading Places | Dataset loading failed:', error);

        if (errorHandler) {
            errorHandler.handleDataLoadingError(error, 'Active Dataset', 'loading');
        } else {
            ui.notifications.error(`Failed to load dataset: ${error.message}`, { permanent: true });
        }

        throw error;
    }
}

/**
 * Initialize proper scene controls integration ONLY
 */
async function initializeProperSceneControls() {
    console.log('Trading Places | Initializing proper scene controls integration');

    try {
        // Initialize proper scene controls integration if available
        if (typeof WFRPProperSceneControls !== 'undefined') {
            const sceneControls = new WFRPProperSceneControls(debugLogger);
            await sceneControls.initialize();
            console.log('Trading Places | Proper scene controls initialized successfully');
        } else {
            console.warn('Trading Places | WFRPProperSceneControls class not available, using basic fallback');
            await initializeBasicSceneControls();
        }
    } catch (error) {
        console.error('Trading Places | Scene controls integration failed:', error);
        ui.notifications.warn('Trading scene controls integration failed.');
    }
}

/**
 * Basic scene controls fallback when WFRPProperSceneControls class is not available
 */
async function initializeBasicSceneControls() {
    console.log('Trading Places | Initializing basic scene controls fallback');
    
    try {
        // Register the scene controls hook directly since the class approach isn't working
        console.log('Trading Places | Registering scene controls hook directly as fallback');
        
        Hooks.on('getSceneControlButtons', (controls) => {
            console.log('Trading Places | getSceneControlButtons hook fired - adding trading controls');
            
            // Check if our control already exists to prevent duplicates
            const existingControl = controls.find(c => c.name === 'trading-places');
            if (existingControl) {
                console.log('Trading Places | Trading control already exists, skipping duplicate');
                return;
            }
            
            const tradingControls = {
                name: 'trading-places',
                title: 'Trading Places Places',
                icon: 'fas fa-coins',
                visible: true,
                layer: 'TokenLayer',
                tools: [{
                    name: 'open-trading',
                    title: 'Open Trading Interface',
                    icon: 'fas fa-store',
                    button: true,
                    onClick: () => {
                        console.log('Trading Places | Trading button clicked!');
                        
                        // Try to open the trading interface
                        try {
                            if (window.TradingPlacesEnhancedDialog) {
                                // Get the current controlled actor
                                const controlledTokens = canvas.tokens.controlled;
                                let selectedActor = null;
                                
                                if (controlledTokens.length > 0) {
                                    selectedActor = controlledTokens[0].actor;
                                } else if (game.user.character) {
                                    selectedActor = game.user.character;
                                }
                                
                                if (selectedActor) {
                                    const dialog = new window.TradingPlacesEnhancedDialog(selectedActor, null);
                                    dialog.render(true);
                                    console.log('Trading Places | Opened EnhancedTradingDialog');
                                } else {
                                    ui.notifications.warn('Please select a token or assign a character to use the trading interface.');
                                    console.log('Trading Places | No actor selected for trading');
                                }
                            } else if (window.TradingPlacesApplication) {
                                const app = new window.TradingPlacesApplication();
                                app.render(true);
                                console.log('Trading Places | Opened TradingPlacesApplication (fallback)');
                            } else if (window.WFRPSimpleTradingV2) {
                                window.WFRPSimpleTradingV2.openDialog();
                                console.log('Trading Places | Opened WFRPSimpleTradingV2');
                            } else {
                                ui.notifications.info('Trading interface clicked! (Interface classes not yet available)');
                            }
                        } catch (error) {
                            console.error('Trading Places | Error opening trading interface:', error);
                            ui.notifications.error('Error opening trading interface. Check console for details.');
                        }
                    }
                }, {
                    name: "trading-settings",
                    title: "Trading Places Settings",
                    icon: "fas fa-cog",
                    visible: game.user.isGM,
                    onClick: () => {
                        try {
                            const settingsDialog = new TradingPlacesSettingsDialog();
                            settingsDialog.render(true);
                            console.log('Trading Places | Opened settings dialog');
                        } catch (error) {
                            console.error('Trading Places | Error opening settings dialog:', error);
                            ui.notifications.error('Error opening settings dialog. Check console for details.');
                        }
                    }
                }]
            };
            
            controls.push(tradingControls);
            console.log('Trading Places | Trading controls added successfully to scene controls');
        });
        
        console.log('Trading Places | Basic scene controls fallback complete - hook registered');
        
    } catch (error) {
        console.error('Trading Places | Basic scene controls integration failed:', error);
        ui.notifications.warn('Trading scene controls integration failed.');
    }
}

/**
 * Open the trading interface
 */
function openTradingInterface() {
    try {
        if (typeof window.TradingPlacesEnhancedDialog !== 'undefined') {
            // Get the current controlled actor
            const controlledTokens = canvas.tokens.controlled;
            let selectedActor = null;
            
            if (controlledTokens.length > 0) {
                selectedActor = controlledTokens[0].actor;
            } else if (game.user.character) {
                selectedActor = game.user.character;
            }
            
            if (selectedActor) {
                const dialog = new window.TradingPlacesEnhancedDialog(selectedActor, null);
                dialog.render(true);
            } else {
                ui.notifications.warn('Please select a token or assign a character to use the trading interface.');
            }
        } else if (typeof TradingPlacesApplication !== 'undefined') {
            const app = new TradingPlacesApplication();
            app.render(true);
        } else if (typeof WFRPSimpleTradingApplication !== 'undefined') {
            WFRPSimpleTradingApplication.create();
        } else {
            ui.notifications.error('Trading interface not available.');
        }
    } catch (error) {
        console.error('Trading Places | Error opening trading interface:', error);
        ui.notifications.error('Error opening trading interface. Check console for details.');
    }
}

/**
 * Get available datasets for the active dataset setting
 * @returns {Object} - Object mapping dataset IDs to display names
 */
function getAvailableDatasets() {
    const datasets = {
        'wfrp4e': 'WFRP4e (Built-in)'
    };

    // Add user datasets if they exist
    try {
        if (typeof game !== 'undefined' && game.settings) {
            const userDatasets = game.settings.get('trading-places', 'userDatasets') || [];
            userDatasets.forEach(datasetName => {
                datasets[datasetName] = `${datasetName} (User)`;
            });
        }
    } catch (error) {
        console.warn('Trading Places | Could not load user datasets for settings:', error);
    }

    return datasets;
}

/**
 * Export clean module API
 */
window.TradingPlaces = {
    getDataManager: () => dataManager,
    getTradingEngine: () => tradingEngine,
    getSystemAdapter: () => systemAdapter,
    getDebugLogger: () => debugLogger,
    
    // Simple utility function
    openTradingDialog: () => openTradingInterface(),
    
    // Debug/Test functions
    addTestCargo: async () => {
        const testCargo = {
            id: foundry.utils.randomID(),
            cargo: "Test Grain",
            category: "Bulk Goods", 
            quantity: 75,
            pricePerEP: 1.5,
            totalCost: 112.5,
            settlement: "Altdorf",
            season: "spring",
            date: new Date().toISOString(),
            contraband: false
        };
        
        const currentCargo = await game.settings.get("trading-places", "currentCargo") || [];
        currentCargo.push(testCargo);
        await game.settings.set("trading-places", "currentCargo", currentCargo);
        
        console.log('✅ Test cargo added:', testCargo);
        ui.notifications.info("Added test cargo: 75 EP of Test Grain");
        
        // Re-render any open trading applications
        for (let app of Object.values(ui.windows)) {
            if (app.constructor.name === 'TradingPlacesApplication') {
                app.render(false);
            }
        }
        
        return testCargo;
    },
    
    clearAllCargo: async () => {
        await game.settings.set("trading-places", "currentCargo", []);
        console.log('🗑️ All cargo cleared');
        ui.notifications.info("Cleared all cargo from inventory");
        
        // Re-render any open trading applications
        for (let app of Object.values(ui.windows)) {
            if (app.constructor.name === 'TradingPlacesApplication') {
                app.render(false);
            }
        }
    },
    
    showCargoTab: () => {
        // Force switch to cargo tab and check what's there
        const cargoTab = document.querySelector('.trading-places-tab[data-tab="cargo"]');
        const cargoContent = document.querySelector('#cargo-tab');
        
        if (cargoTab && cargoContent) {
            // Remove active from all tabs - COMMENTED OUT TO FIX CHAT ISSUE
            // document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            // document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Activate cargo tab
            cargoTab.classList.add('active');
            cargoContent.classList.add('active');
            cargoContent.style.display = 'block';
            
            console.log('🚛 Cargo tab activated');
            console.log('🚛 Cargo tab HTML:', cargoContent.innerHTML.substring(0, 500));
            
            // Check what data is in the cargo list
            const cargoList = cargoContent.querySelector('.cargo-list');
            const cargoItems = cargoContent.querySelectorAll('.trading-places-cargo-item');
            const emptyState = cargoContent.querySelector('.empty-cargo');
            
            console.log('🚛 Cargo list element:', cargoList);
            console.log('🚛 Cargo items found:', cargoItems.length);
            console.log('🚛 Empty state visible:', emptyState && emptyState.style.display !== 'none');
            
            return {
                cargoTab, cargoContent, cargoList, cargoItems, emptyState
            };
        } else {
            console.error('❌ Cargo tab elements not found');
            return null;
        }
    }
};

// Also assign to the module object for direct access
if (typeof game !== 'undefined' && game.modules) {
    const module = game.modules.get('trading-places');
    if (module) {
        module.dataManager = dataManager;
        module.tradingEngine = tradingEngine;
        module.systemAdapter = systemAdapter;
        module.debugLogger = debugLogger;
    }
}

// Debug function to open settings dialog
window.openTradingPlacesSettings = function() {
    try {
        const dialog = new TradingPlacesSettingsDialog();
        dialog.render(true);
        console.log('Trading Places | Settings dialog opened via debug function');
        return dialog;
    } catch (error) {
        console.error('Trading Places | Error opening settings dialog:', error);
        return null;
    }
};