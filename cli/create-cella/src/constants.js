export const NAME = 'create-cella'

// URL of the template repository
export const TEMPLATE_URL = 'github:cellajs/cella';

// Files or folders to be removed from the template after downloading
export const TO_REMOVE = [
    'info',
    './cli/create-cella'
];

// Specific folder contents to be cleaned out from the template
export const TO_CLEAN = [
    './backend/drizzle'
];

// Files to copy/paste after downloading
export const TO_COPY = {
    './backend/.env.example': './backend/.env',
    './tus/.env.example': './tus/.env',
    './info/QUICKSTART.md': 'README.md',
};

// ASCII title for the CLI output
export const CELLA_TITLE = `
                         _ _            
    ▒▓█████▓▒     ___ ___| | | __ _
    ▒▓█   █▓▒    / __/ _ \\ | |/ _\` |
    ▒▓█   █▓▒   | (_|  __/ | | (_| |
    ▒▓█████▓▒    \\___\\___|_|_|\\__,_|
`;