// Image Prompt Generator Service for Bolt + Supabase
// Can be used as a utility service or API endpoint

interface CharacterRequest {
  name: string;
  gender: string;
  height: string;
  build: string;
  eye_color: string;
  hair_color: string;
  skin_tone: string;
  personality_traits: string[];
  art_style: 'anime' | 'american_comic' | 'realistic' | 'video_game_3d';
}

interface StyleTemplate {
  prefix: string;
  visual_elements: string[];
  technical_specs: string[];
  lighting: string;
}

// Style templates for different art styles
const STYLE_TEMPLATES: Record<string, StyleTemplate> = {
  anime: {
    prefix: "Anime style portrait of a fictional",
    visual_elements: [
      "large expressive eyes",
      "stylized anime proportions",
      "cel-shaded appearance",
      "vibrant anime colors",
      "clean line art"
    ],
    technical_specs: [
      "high-quality anime illustration",
      "studio anime style",
      "detailed anime art",
      "professional anime character design"
    ],
    lighting: "soft anime lighting with dramatic highlights"
  },

  american_comic: {
    prefix: "American comic book style portrait of a fictional",
    visual_elements: [
      "bold comic book line art",
      "dynamic comic book shading",
      "vibrant colors with dramatic highlights",
      "cel-shaded appearance",
      "classic four-color comic style"
    ],
    technical_specs: [
      "modern American superhero comic book illustration",
      "DC/Marvel comic art style",
      "professional comic book cover quality",
      "dynamic comic book composition"
    ],
    lighting: "dramatic comic book lighting with bold shadows"
  },

  realistic: {
    prefix: "Photorealistic portrait of a fictional",
    visual_elements: [
      "natural skin texture",
      "detailed facial features",
      "realistic proportions",
      "subtle natural lighting",
      "high detail and clarity"
    ],
    technical_specs: [
      "professional portrait photography style",
      "studio portrait lighting",
      "sharp focus",
      "high-end digital art realism",
      "detailed photorealistic rendering"
    ],
    lighting: "professional studio lighting with soft shadows"
  },

  video_game_3d: {
    prefix: "3D video game character render of a fictional",
    visual_elements: [
      "high-poly 3D model appearance",
      "stylized realistic proportions",
      "clean 3D rendering",
      "modern game engine quality",
      "detailed texture work"
    ],
    technical_specs: [
      "AAA video game character design",
      "Unreal Engine/Unity style rendering",
      "next-gen game character quality",
      "professional 3D character art",
      "high-resolution game asset style"
    ],
    lighting: "dynamic 3D lighting with ambient occlusion"
  }
};

// Character trait mappings for expressions and poses
const PERSONALITY_EXPRESSIONS: Record<string, string> = {
  serious: "focused, determined expression with intense gaze",
  adventurous: "confident expression with a hint of excitement and curiosity",
  playful: "mischievous grin with sparkling, playful eyes",
  creative: "thoughtful expression with artistic flair and imaginative spark",
  chaotic: "wild, unpredictable expression with energetic intensity",
  intelligent: "sharp, analytical gaze with thoughtful composure",
  mysterious: "enigmatic expression with subtle, knowing smile",
  friendly: "warm, approachable smile with kind eyes",
  confident: "self-assured expression with commanding presence"
};

/**
 * Generate a detailed image prompt for AI image generation
 */
export function generateImagePrompt(request: CharacterRequest): string {
  const template = STYLE_TEMPLATES[request.art_style];
  
  if (!template) {
    throw new Error(`Unsupported art style: ${request.art_style}`);
  }

  const promptParts: string[] = [];

  // Start with style prefix and basic description
  promptParts.push(
    `${template.prefix} ${request.height} ${request.gender} with ${request.build} build`
  );

  // Add physical features
  promptParts.push(
    `${request.eye_color} eyes, ${request.hair_color}, ${request.skin_tone} skin tone`
  );

  // Add personality-based expression
  if (request.personality_traits && request.personality_traits.length > 0) {
    const expressions: string[] = [];
    
    for (const trait of request.personality_traits) {
      const expression = PERSONALITY_EXPRESSIONS[trait.toLowerCase()];
      if (expression) {
        expressions.push(expression);
      }
    }

    if (expressions.length > 0) {
      // Limit to 2 expressions to avoid overcrowding
      promptParts.push(`Character expression: ${expressions.slice(0, 2).join(', ')}`);
    }
  }

  // Add style-specific visual elements
  promptParts.push(...template.visual_elements);

  // Add neutral background
  promptParts.push("Background: soft, neutral tones");

  // Add technical specifications
  promptParts.push(`Style: ${template.technical_specs.join(', ')}`);
  promptParts.push(`Lighting: ${template.lighting}`);

  // Join all parts with appropriate separators
  return promptParts.join('. ') + '.';
}

/**
 * Get available art styles and their descriptions
 */
export function getAvailableStyles(): Record<string, Partial<StyleTemplate>> {
  const styles: Record<string, Partial<StyleTemplate>> = {};
  
  for (const [styleName, template] of Object.entries(STYLE_TEMPLATES)) {
    styles[styleName] = {
      prefix: template.prefix,
      visual_elements: template.visual_elements.slice(0, 3), // Show first 3 elements
    };
  }
  
  return styles;
}

/**
 * Validate character request data
 */
export function validateCharacterRequest(request: Partial<CharacterRequest>): CharacterRequest {
  const required = ['name', 'gender', 'height', 'build', 'eye_color', 'hair_color', 'skin_tone', 'art_style'];
  
  for (const field of required) {
    if (!request[field as keyof CharacterRequest]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!STYLE_TEMPLATES[request.art_style as string]) {
    throw new Error(`Invalid art style: ${request.art_style}`);
  }

  return request as CharacterRequest;
}

// Example usage for testing
export const exampleRequest: CharacterRequest = {
  name: "Luna Starweaver",
  gender: "female",
  height: "tall",
  build: "athletic",
  eye_color: "emerald green",
  hair_color: "curly red hair",
  skin_tone: "fair",
  personality_traits: ["serious", "intelligent"],
  art_style: "anime"
};

// For API endpoint usage (Next.js API route example)
export async function handlePromptGeneration(req: any, res: any) {
  try {
    const characterData = validateCharacterRequest(req.body);
    const prompt = generateImagePrompt(characterData);
    
    res.status(200).json({
      success: true,
      prompt: prompt,
      character_name: characterData.name
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// For Supabase Edge Function usage
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function handleSupabaseEdgeFunction(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const characterData = await req.json();
    const validatedData = validateCharacterRequest(characterData);
    const prompt = generateImagePrompt(validatedData);

    return new Response(
      JSON.stringify({
        success: true,
        prompt: prompt,
        character_name: validatedData.name
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
}