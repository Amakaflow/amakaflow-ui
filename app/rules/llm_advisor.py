"""
LLM Rules Advisor
Uses AI to generate nuanced workout suggestions beyond hard rules.
"""

import json
import os
from typing import List, Dict, Any, Optional


class LLMRulesAdvisor:
    """
    Uses LLM to provide intelligent workout suggestions
    based on context and rules engine results.
    """
    
    def __init__(self):
        self._client = None
        self.model = "gpt-4o-mini"
    
    @property
    def client(self):
        """Lazy-load OpenAI client only when needed"""
        if self._client is None:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                return None
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=api_key)
        return self._client
    
    async def get_suggestions(
        self, 
        context: Dict[str, Any], 
        rule_results: Dict[str, Any],
        user_goals: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Get AI-powered workout suggestions."""
        if self.client is None:
            return []
        
        prompt = self._build_prompt(context, rule_results, user_goals)
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert fitness programming coach. Always respond with valid JSON only."
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            content = response.choices[0].message.content
            
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            data = json.loads(content.strip())
            
            if isinstance(data, dict) and "suggestions" in data:
                return data["suggestions"]
            elif isinstance(data, list):
                return data
            return []
                
        except Exception as e:
            print(f"LLM advisor error: {e}")
            return []
    
    def _build_prompt(
        self, 
        context: Dict[str, Any], 
        rule_results: Dict[str, Any], 
        user_goals: Optional[List[str]] = None
    ) -> str:
        goals_str = ", ".join(user_goals) if user_goals else "general fitness"
        
        prompt = f"""Based on this training context, suggest 1-2 optimal workouts for today.

Previous Day: {json.dumps(context.get('previous_day', {}), indent=2)}
Week So Far: {json.dumps(context.get('week', {}), indent=2)}
User Goals: {goals_str}

Prevented (DO NOT suggest): {json.dumps(rule_results.get('prevents', []), indent=2)}
Already Suggested: {json.dumps(rule_results.get('suggests', []), indent=2)}

Respond with JSON only. Format:
{{
  "suggestions": [
    {{
      "block_type": "strength or run or recovery or mobility or hyrox",
      "title": "Workout name",
      "primary_muscle": "upper or lower or core or full_body or none",
      "intensity": 1,
      "duration": 30,
      "reason": "Why this workout",
      "source": "AI Recommendation"
    }}
  ]
}}"""
        return prompt

    async def analyze_week(
        self, 
        events: List[Dict[str, Any]], 
        user_goals: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        if self.client is None:
            return {"error": "OpenAI API key not configured"}
        return {"error": "Not implemented"}
