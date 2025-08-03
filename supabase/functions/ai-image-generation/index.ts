import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CharacterRequest {
  name: string;
  gender: string;
  height: string;
  build: string;
  eye_color: string;
  hair_color: string;
  skin_tone: string;
  personality_traits: string[];
  art_style: string;
}

// Exponential backoff retry wrapper
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Timeout wrapper for AI image generation
      const timeoutPromise = new Promise<never>((_, reject) => {
        // For 90 seconds  
        setTimeout(() => reject(new Error('Operation timeout')), 90000);
      });
      
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

// Fallback character images based on gender and style
const getFallbackImage = (gender: string, art_style: string): string => {
  const fallbackImages = {
    male: {
      anime: '/art-styles/male anime.jpg',
      '3d': '/art-styles/male 3d.jpg',
      comic: '/art-styles/male comicbook.jpg',
      realistic: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      default: '/art-styles/male anime.jpg'
    },
    female: {
      anime: 'https://images.pexels.com/photos/3992656/pexels-photo-3992656.png?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      '3d': '/art-styles/female 3d.jpg',
      comic: '/art-styles/female comicbook.jpg',
      realistic: '/art-styles/female realistic.jpg',
      default: '/art-styles/female 3d.jpg'
    },
    nonbinary: {
      anime: '/art-styles/male anime.jpg',
      '3d': '/art-styles/male 3d.jpg',
      comic: '/art-styles/male comicbook.jpg',
      realistic: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      default: '/art-styles/male anime.jpg'
    }
  };

  const genderImages = fallbackImages[gender as keyof typeof fallbackImages] || fallbackImages.nonbinary;
  return genderImages[art_style as keyof typeof genderImages] || genderImages.default;
};

// Generate optimized prompt for OpenAI DALL-E
const generateOpenAIPrompt = (request: CharacterRequest): string => {
  const { gender, height, build, eye_color, hair_color, skin_tone, personality_traits, art_style } = request;

  // Enhanced art style descriptions optimized for DALL-E
  let stylePrefix = '';
  let styleDetails = '';
  let qualityTags = '';
  
  switch (art_style) {
    case 'anime':
      stylePrefix = 'anime style, manga style';
      styleDetails = 'large expressive eyes, vibrant colors, cel-shaded, clean line art, anime proportions, detailed hair';
      qualityTags = 'high quality anime art, studio quality';
      break;
    case '3d':
      stylePrefix = '3d render, digital art';
      styleDetails = 'realistic 3d rendering, soft lighting, detailed textures, modern 3d art style';
      qualityTags = 'high quality 3d render, professional 3d modeling';
      break;
    case 'comic':
      stylePrefix = 'comic book style, western comic art';
      styleDetails = 'bold clean line art, dynamic poses, vibrant colors, comic book shading';
      qualityTags = 'professional comic illustration, marvel style';
      break;
    case 'realistic':
      stylePrefix = 'photorealistic, realistic portrait';
      styleDetails = 'natural human proportions, realistic skin textures, detailed facial features, natural lighting';
      qualityTags = 'photorealistic, high resolution, professional portrait';
      break;
    default:
      stylePrefix = 'digital art, illustration';
      styleDetails = 'professional artistic quality, appealing character design, vibrant colors';
      qualityTags = 'high quality digital art, professional illustration';
  }

  // Build personality-influenced description
  const personalityDescription = personality_traits.length > 0 
    ? `${personality_traits.slice(0, 3).join(', ')} personality, expressive face`
    : 'friendly and approachable expression';

  // Construct the optimized prompt for DALL-E
  const prompt = `${stylePrefix}, portrait of a ${gender} character, ${height} height, ${build} build, ${eye_color} eyes, ${hair_color} hair, ${skin_tone} skin, ${personalityDescription}, ${styleDetails}, upper body shot, centered composition, ${qualityTags}`;

  return prompt;
};

// Try image generation APIs in priority order
const tryImageGenerationAPIs = async (request: CharacterRequest): Promise<{ imageUrl: string; provider: string; prompt?: string }> => {
  const prompt = generateOpenAIPrompt(request);
  
  // 1. Try OpenAI DALL-E API (Primary - Best Quality)
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('OPENAI_PROJ_API_KEY');
  if (openaiApiKey) {
    try {
      console.log('Trying OpenAI DALL-E API...');
      
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          style: 'natural'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
        
        // Check for specific error types
        if (response.status === 400 && errorData.error?.code === 'content_policy_violation') {
          throw new Error('Image prompt violates content policy. Please try different character traits.');
        } else if (response.status === 429) {
          throw new Error('OpenAI rate limit exceeded. Please try again later.');
        } else if (response.status === 401) {
          throw new Error('OpenAI API authentication failed. Please check your API key.');
        }
        
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.data && data.data[0] && data.data[0].url) {
        console.log('Successfully generated image using OpenAI DALL-E');
        return { imageUrl: data.data[0].url, provider: 'openai-dalle', prompt };
      }
      
      throw new Error('OpenAI API returned no image data');
      
    } catch (error) {
      console.error('Error with OpenAI DALL-E API:', error);
      // Don't immediately fallback for content policy violations
      if (error.message.includes('content policy')) {
        throw error;
      }
    }
  }

  // 2. Try Stability AI API (Secondary - if configured)
  const stabilityApiKey = Deno.env.get('STABILITY_AI_API_KEY');
  if (stabilityApiKey) {
    try {
      console.log('Trying Stability AI API...');
      
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('aspect_ratio', '1:1');
      formData.append('output_format', 'png');

      const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stabilityApiKey}`,
          'Accept': 'image/*',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Stability AI API error: ${response.status} - ${errorText}`);
        throw new Error(`Stability AI API error: ${response.statusText}`);
      }

      // Convert response to base64
      const imageBuffer = await response.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
      const imageUrl = `data:image/png;base64,${base64Image}`;
      
      console.log('Successfully generated image using Stability AI');
      return { imageUrl, provider: 'stability-ai', prompt };
      
    } catch (error) {
      console.error('Error with Stability AI API:', error);
    }
  }

  // 3. Try Hugging Face API (Tertiary - Free)
  const huggingFaceApiKey = Deno.env.get('HUGGING_FACE_API_KEY');
  if (huggingFaceApiKey) {
    try {
      console.log('Trying Hugging Face API...');
      
      const response = await fetch('https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${huggingFaceApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            num_inference_steps: 30,
            guidance_scale: 7.5,
            width: 512,
            height: 512,
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Hugging Face API error: ${response.status} - ${errorText}`);
        throw new Error(`Hugging Face API error: ${response.statusText}`);
      }

      if (response.headers.get('content-type')?.includes('image')) {
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        console.log('Successfully generated image using Hugging Face');
        return { imageUrl: `data:image/png;base64,${base64}`, provider: 'hugging-face', prompt };
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Unknown error from Hugging Face API');
      }
      
    } catch (error) {
      console.error('Error with Hugging Face API:', error);
    }
  }

  throw new Error('All AI image generation APIs failed or are not configured');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name, gender, height, build, eye_color, hair_color, skin_tone, personality_traits, art_style } = await req.json() as CharacterRequest;

    // Try AI image generation APIs
    try {
      console.log('Attempting AI image generation...');
      
      const result = await withRetry(async () => {
        return await tryImageGenerationAPIs({
          name, gender, height, build, eye_color, hair_color, skin_tone, personality_traits, art_style
        });
      });

      return new Response(
        JSON.stringify({ 
          success: true,
          image_url: result.imageUrl,
          model_used: result.provider,
          prompt_used: result.prompt,
          generation_time: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
      
    } catch (aiError) {
      console.error('AI image generation error:', aiError);
      
      // Use fallback image generation based on character attributes
      const fallbackImageUrl = getFallbackImage(gender, art_style);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          image_url: fallbackImageUrl,
          fallback: true,
          message: 'Character created with curated reference image. AI image generation temporarily unavailable.',
          error_details: aiError.message,
          fallback_reason: 'AI APIs failed or not configured'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Unexpected error in ai-image-generation:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'An unexpected error occurred. Please try again later.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});