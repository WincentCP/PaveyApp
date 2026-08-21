if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    load_dotenv('d:/PaveyApp/backend/.env')
    try:
        import google.generativeai as genai
        genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(m.name)
    except Exception as e:
        print(f"Error checking Gemini models: {e}")

