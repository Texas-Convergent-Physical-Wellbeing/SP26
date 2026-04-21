export interface HealthTag {
  label: string;
  color: 'green' | 'orange';
}

export interface Recipe {
  id: string;
  name: string;
  tag?: string;
  imageUrl: string;
  /** Card height in the masonry grid */
  height: number;
  /** Detail page data */
  prepTime: string;
  cookTime: string;
  servings: number;
  ingredients: string[];
  description: string;
  steps: string[];
  /** Nutrition info */
  calories: number;
  carbsPercent: number;
  fatsPercent: number;
  proteinPercent: number;
  healthTags: HealthTag[];
  whyItWorks: string;
}

function aiFood(prompt: string, seed: number, height = 500): string {
  // Intentionally pinned to `flux` — every curated recipe's URL is already
  // warm in Pollinations' server-side cache under these exact params, so the
  // images load near-instantly on any device that has hit the CDN before.
  // Changing the model or prompt text invalidates that cache and forces
  // every recipe to regenerate (10–15s each), which breaks the community tab.
  const encoded = encodeURIComponent(
    `${prompt}, professional food photography, soft natural lighting, shallow depth of field, appetizing, high quality`,
  );
  return `https://image.pollinations.ai/prompt/${encoded}?seed=${seed}&width=400&height=${height}&nologo=true&model=flux`;
}

export const RECIPES: Recipe[] = [
  {
    id: '1',
    name: 'Avocado Toast',
    tag: 'Vegetarian',
    imageUrl: aiFood('avocado toast with poached egg on sourdough bread', 101),
    height: 165,
    prepTime: '10 min',
    cookTime: '5 min',
    servings: 1,
    ingredients: [
      '2 slices sourdough bread',
      '1 ripe avocado',
      '2 eggs',
      '1 tbsp lemon juice',
      'Red pepper flakes',
      'Salt & pepper to taste',
      'Fresh dill for garnish',
    ],
    description:
      'A quick and nourishing breakfast that pairs creamy mashed avocado with perfectly poached eggs on golden sourdough. Rich in healthy fats and plant protein to keep you energized all morning.',
    steps: [
      'Toast the sourdough slices until golden and crisp.',
      'Halve and pit the avocado. Scoop the flesh into a bowl, add lemon juice, salt, and pepper, then mash to your desired texture.',
      'Bring a small pot of water to a gentle simmer. Crack each egg into a cup, swirl the water, and slide the eggs in. Poach for 3 minutes.',
      'Spread the mashed avocado generously over each toast slice.',
      'Top with a poached egg, a pinch of red pepper flakes, and fresh dill. Serve immediately.',
    ],
    calories: 420,
    carbsPercent: 38,
    fatsPercent: 40,
    proteinPercent: 22,
    healthTags: [
      { label: 'Heart Healthy', color: 'green' },
      { label: 'High Fiber', color: 'green' },
      { label: 'Vegetarian', color: 'green' },
      { label: 'Moderate Sodium', color: 'orange' },
    ],
    whyItWorks:
      'Avocado delivers **heart-healthy monounsaturated fats** that help lower LDL cholesterol. The poached egg adds **complete protein and choline**, supporting brain function. Sourdough\'s fermentation process lowers its glycemic impact, giving you **steady energy** rather than a spike.',
  },
  {
    id: '2',
    name: 'Korean BBQ Bowl',
    tag: 'High-Protein',
    imageUrl: aiFood('Korean BBQ beef bowl with rice, sesame seeds and kimchi', 102, 400),
    height: 133,
    prepTime: '20 min',
    cookTime: '15 min',
    servings: 2,
    ingredients: [
      '400g ribeye beef, thinly sliced',
      '3 tbsp soy sauce',
      '2 tbsp sesame oil',
      '1 tbsp brown sugar',
      '4 garlic cloves, minced',
      '1 tsp fresh ginger',
      '2 cups steamed jasmine rice',
      'Kimchi to serve',
    ],
    description:
      'Bold Korean flavors come together in this satisfying BBQ bowl. Tender marinated beef is seared to perfection and served over fluffy jasmine rice with tangy kimchi for a meal that hits every craving.',
    steps: [
      'Combine soy sauce, sesame oil, brown sugar, garlic, and ginger in a bowl. Add the sliced beef, toss well, and marinate for at least 15 minutes.',
      'Heat a large skillet or grill pan over high heat until very hot.',
      'Cook the beef in a single layer for 2–3 minutes per side until caramelized. Work in batches to avoid steaming.',
      'Divide steamed rice between two bowls.',
      'Top each bowl with the cooked beef and a generous serving of kimchi. Garnish with sesame seeds.',
    ],
    calories: 580,
    carbsPercent: 35,
    fatsPercent: 32,
    proteinPercent: 33,
    healthTags: [
      { label: 'High-Protein', color: 'green' },
      { label: 'Probiotic-Rich', color: 'green' },
      { label: 'High Iron', color: 'orange' },
      { label: 'Moderate Sodium', color: 'orange' },
    ],
    whyItWorks:
      'Ribeye provides **complete amino acids** essential for muscle repair. Kimchi is a **probiotic powerhouse** that supports gut health and immunity. Sesame oil contributes **anti-inflammatory lignans**, and garlic adds **allicin**, a potent antioxidant compound.',
  },
  {
    id: '3',
    name: 'Chicken Tacos',
    tag: 'Mexican',
    imageUrl: aiFood('grilled chicken street tacos with salsa, lime and cilantro', 103, 600),
    height: 249,
    prepTime: '15 min',
    cookTime: '20 min',
    servings: 4,
    ingredients: [
      '500g chicken thighs',
      '8 small corn tortillas',
      '2 tsp ground cumin',
      '1 tsp chili powder',
      '1 lime, juiced',
      'Fresh cilantro',
      'Salsa verde',
      '1 avocado, sliced',
    ],
    description:
      'Street-style chicken tacos bursting with smoky spices, fresh lime, and vibrant salsa verde. These easy tacos come together fast and deliver authentic Mexican flavors in every bite.',
    steps: [
      'Season the chicken thighs with cumin, chili powder, salt, and half the lime juice.',
      'Grill or pan-sear the chicken over medium-high heat for 6–7 minutes per side until cooked through. Let rest for 5 minutes.',
      'Slice or shred the chicken into bite-sized pieces.',
      'Warm the corn tortillas in a dry skillet for 30 seconds per side.',
      'Assemble the tacos with chicken, avocado slices, salsa verde, cilantro, and a squeeze of remaining lime juice.',
    ],
    calories: 390,
    carbsPercent: 32,
    fatsPercent: 28,
    proteinPercent: 40,
    healthTags: [
      { label: 'High-Protein', color: 'green' },
      { label: 'Gluten-Free', color: 'green' },
      { label: 'Low Glycemic', color: 'green' },
      { label: 'Moderate Fat', color: 'orange' },
    ],
    whyItWorks:
      'Chicken thighs offer **higher zinc and iron** than breast meat, supporting immune function. Corn tortillas are naturally **gluten-free and lower glycemic** than flour alternatives. Avocado adds **potassium and folate**, while cilantro provides **heavy-metal chelating** compounds.',
  },
  {
    id: '4',
    name: 'Greek Salad',
    tag: 'Vegan',
    imageUrl: aiFood('fresh Greek salad with tomatoes, cucumber, olives and feta cheese', 104, 480),
    height: 191,
    prepTime: '15 min',
    cookTime: '0 min',
    servings: 2,
    ingredients: [
      '2 large tomatoes, chopped',
      '1 cucumber, sliced',
      '1/2 red onion, thinly sliced',
      '100g kalamata olives',
      '150g feta cheese',
      '2 tbsp extra virgin olive oil',
      '1 tsp dried oregano',
      'Salt & pepper to taste',
    ],
    description:
      'A refreshing Mediterranean classic that needs no cooking. Crisp vegetables, briny olives, and creamy feta come together with extra virgin olive oil for a light yet satisfying meal.',
    steps: [
      'Chop tomatoes into large chunks and slice the cucumber into half-moons.',
      'Thinly slice the red onion and separate into rings.',
      'Combine tomatoes, cucumber, red onion, and kalamata olives in a large bowl.',
      'Drizzle with extra virgin olive oil, sprinkle with dried oregano, salt, and pepper. Toss gently.',
      'Top with a block or crumbles of feta cheese. Serve immediately or refrigerate for up to an hour.',
    ],
    calories: 280,
    carbsPercent: 22,
    fatsPercent: 58,
    proteinPercent: 20,
    healthTags: [
      { label: 'Low Sodium', color: 'green' },
      { label: 'Heart Healthy', color: 'green' },
      { label: 'Low Glycemic', color: 'green' },
      { label: 'High Potassium', color: 'orange' },
    ],
    whyItWorks:
      'Extra virgin olive oil is rich in **oleocanthal**, a natural anti-inflammatory comparable to ibuprofen at lower doses. Kalamata olives add **vitamin E and healthy monounsaturated fats**. Tomatoes provide **lycopene**, a powerful antioxidant linked to reduced heart disease risk.',
  },
  {
    id: '5',
    name: 'Mushroom Risotto',
    tag: 'Vegetarian',
    imageUrl: aiFood('creamy mushroom risotto in a white bowl with parmesan', 105, 450),
    height: 176,
    prepTime: '10 min',
    cookTime: '30 min',
    servings: 2,
    ingredients: [
      '300g arborio rice',
      '200g mixed mushrooms, sliced',
      '1L warm vegetable stock',
      '1 small onion, finely diced',
      '2 garlic cloves, minced',
      '100ml dry white wine',
      '50g parmesan, grated',
      '2 tbsp unsalted butter',
    ],
    description:
      'Luxuriously creamy Italian risotto packed with earthy mixed mushrooms. The slow-stirred arborio rice releases its starch naturally, creating a velvety sauce that needs no cream.',
    steps: [
      'Sauté onion in butter over medium heat until translucent, about 4 minutes. Add garlic and cook 1 minute more.',
      'Add sliced mushrooms and cook until golden and moisture has evaporated, about 5 minutes.',
      'Add arborio rice and stir for 2 minutes until the edges turn translucent.',
      'Pour in the white wine and stir until absorbed. Add warm stock one ladle at a time, stirring constantly and waiting until each addition is absorbed before adding more.',
      'After about 20 minutes, when the rice is al dente and the mixture is creamy, remove from heat. Stir in parmesan, season to taste, and serve immediately.',
    ],
    calories: 490,
    carbsPercent: 58,
    fatsPercent: 22,
    proteinPercent: 20,
    healthTags: [
      { label: 'Vegetarian', color: 'green' },
      { label: 'Immune Boosting', color: 'green' },
      { label: 'Moderate Iron', color: 'orange' },
      { label: 'Moderate Sodium', color: 'orange' },
    ],
    whyItWorks:
      'Mushrooms are one of the few plant sources of **vitamin D** and contain **beta-glucans** that enhance immune response. Arborio rice provides **sustained energy** through complex carbohydrates. Parmesan adds **calcium and glutamates** that deepen flavor without artificial additives.',
  },
  {
    id: '6',
    name: 'Salmon Teriyaki',
    tag: 'Gluten-Free',
    imageUrl: aiFood('glazed teriyaki salmon fillet with steamed bok choy and rice', 106, 650),
    height: 267,
    prepTime: '10 min',
    cookTime: '15 min',
    servings: 2,
    ingredients: [
      '2 salmon fillets (200g each)',
      '3 tbsp soy sauce (gluten-free tamari)',
      '2 tbsp mirin',
      '1 tbsp honey',
      '1 tsp sesame oil',
      '2 bok choy, halved',
      'Steamed jasmine rice',
      'Sesame seeds to garnish',
    ],
    description:
      'Silky teriyaki-glazed salmon with a lacquered finish, served alongside tender bok choy and fluffy jasmine rice. A weeknight dinner that feels restaurant-worthy with minimal effort.',
    steps: [
      'Whisk together tamari, mirin, honey, and sesame oil in a small bowl to make the teriyaki glaze.',
      'Heat an oven-safe skillet over medium-high heat. Sear the salmon skin-side up for 3 minutes until golden.',
      'Flip the salmon and pour the glaze over it. Spoon the glaze over the fillets repeatedly for 2 minutes.',
      'Transfer the skillet to a 200°C (390°F) oven for 5–6 minutes until the salmon is cooked through.',
      'Steam or pan-fry the bok choy until wilted. Serve the salmon over rice with bok choy, spooning remaining glaze on top. Garnish with sesame seeds.',
    ],
    calories: 520,
    carbsPercent: 28,
    fatsPercent: 35,
    proteinPercent: 37,
    healthTags: [
      { label: 'Heart Healthy', color: 'green' },
      { label: 'Gluten-Free', color: 'green' },
      { label: 'Omega-3 Rich', color: 'green' },
      { label: 'High Potassium', color: 'orange' },
    ],
    whyItWorks:
      'Salmon is one of the richest sources of **omega-3 fatty acids (EPA & DHA)**, reducing inflammation and supporting cardiovascular health. Bok choy provides **vitamin K and calcium** for bone density. Honey in the glaze gives a **lower glycemic sweetness** than refined sugar.',
  },
  {
    id: '7',
    name: 'Black Bean Burrito',
    tag: 'Mexican',
    imageUrl: aiFood('black bean and veggie burrito wrap cut in half, colorful filling', 107),
    height: 195,
    prepTime: '15 min',
    cookTime: '10 min',
    servings: 2,
    ingredients: [
      '2 large flour tortillas',
      '400g black beans, drained & rinsed',
      '1 cup cooked brown rice',
      '1 cup shredded romaine lettuce',
      '1 avocado, sliced',
      'Fresh salsa',
      '2 tbsp sour cream',
      'Cheddar cheese, shredded',
    ],
    description:
      'A hearty, filling burrito loaded with fiber-rich black beans, nutty brown rice, and fresh toppings. Vegetarian-friendly and endlessly customizable, this wrap is a satisfying lunch or dinner.',
    steps: [
      'Warm the black beans in a small saucepan with a pinch of cumin and salt over medium heat for 3–4 minutes.',
      'Warm the flour tortillas in a dry skillet for 20 seconds per side.',
      'Layer each tortilla with brown rice, black beans, shredded cheese, and lettuce.',
      'Add avocado slices, a spoonful of fresh salsa, and sour cream.',
      'Fold the sides of the tortilla in, then roll tightly from the bottom. Cut in half diagonally and serve.',
    ],
    calories: 460,
    carbsPercent: 52,
    fatsPercent: 28,
    proteinPercent: 20,
    healthTags: [
      { label: 'High Fiber', color: 'green' },
      { label: 'Vegetarian', color: 'green' },
      { label: 'Moderate Iron', color: 'orange' },
      { label: 'Moderate Sodium', color: 'orange' },
    ],
    whyItWorks:
      'Black beans are a **fiber and resistant starch champion**, feeding beneficial gut bacteria and slowing glucose absorption. Brown rice adds **magnesium and B vitamins** for energy metabolism. Avocado\'s **healthy fats** help absorb fat-soluble vitamins from the vegetables.',
  },
  {
    id: '8',
    name: 'Smoothie Bowl',
    tag: 'Diabetes',
    imageUrl: aiFood('vibrant acai smoothie bowl topped with fresh berries, granola and chia seeds', 108, 420),
    height: 170,
    prepTime: '10 min',
    cookTime: '0 min',
    servings: 1,
    ingredients: [
      '1 frozen banana',
      '100g frozen mixed berries',
      '2 tbsp acai powder',
      '1/2 cup unsweetened almond milk',
      'Granola for topping',
      'Fresh strawberries, sliced',
      '1 tsp chia seeds',
      'Drizzle of honey',
    ],
    description:
      'A vibrant and antioxidant-loaded breakfast bowl that looks as good as it tastes. Blended frozen fruit creates a thick, ice cream-like base topped with crunchy granola and fresh berries.',
    steps: [
      'Combine frozen banana, frozen mixed berries, acai powder, and almond milk in a blender.',
      'Blend on high until smooth and thick — the mixture should be thicker than a drinkable smoothie. Add more almond milk only if necessary.',
      'Pour into a bowl and smooth the top with the back of a spoon.',
      'Arrange granola, sliced strawberries, and other toppings in rows or clusters.',
      'Finish with a drizzle of honey and the chia seeds. Serve immediately.',
    ],
    calories: 340,
    carbsPercent: 62,
    fatsPercent: 18,
    proteinPercent: 20,
    healthTags: [
      { label: 'Low Glycemic', color: 'green' },
      { label: 'Diabetic-Friendly', color: 'green' },
      { label: 'Antioxidant-Rich', color: 'green' },
      { label: 'Moderate Sugar', color: 'orange' },
    ],
    whyItWorks:
      'Acai berries contain **anthocyanins**, some of nature\'s most potent antioxidants, linked to improved insulin sensitivity. Chia seeds provide **omega-3s and soluble fiber** that slow glucose absorption — especially beneficial for blood sugar management. The frozen banana base avoids added sugars.',
  },
  {
    id: '9',
    name: 'Honey Garlic Shrimp',
    tag: 'Low-Carb',
    imageUrl: aiFood('honey garlic glazed shrimp in a skillet with herbs and lemon', 109, 400),
    height: 155,
    prepTime: '10 min',
    cookTime: '10 min',
    servings: 2,
    ingredients: [
      '400g large shrimp, peeled & deveined',
      '4 garlic cloves, minced',
      '3 tbsp honey',
      '2 tbsp soy sauce',
      '1 tbsp olive oil',
      '1 tsp cornstarch',
      'Fresh parsley, chopped',
      'Lemon wedges to serve',
    ],
    description:
      'Juicy shrimp glazed in a sticky, sweet-savory honey garlic sauce that cooks in under 10 minutes. An impressive weeknight dinner that comes together faster than delivery.',
    steps: [
      'Pat shrimp dry with paper towels. Whisk together honey, soy sauce, and cornstarch in a small bowl.',
      'Heat olive oil in a large skillet over medium-high heat.',
      'Add the shrimp in a single layer and cook for 1–2 minutes until pink on one side. Flip each shrimp.',
      'Add minced garlic and cook for 30 seconds until fragrant. Pour the honey-soy mixture over the shrimp.',
      'Toss everything together and cook for 1–2 minutes more until the sauce thickens and coats the shrimp. Garnish with parsley and serve with lemon wedges.',
    ],
    calories: 310,
    carbsPercent: 28,
    fatsPercent: 22,
    proteinPercent: 50,
    healthTags: [
      { label: 'High-Protein', color: 'green' },
      { label: 'Low-Carb', color: 'green' },
      { label: 'Low Saturated Fat', color: 'green' },
      { label: 'High Sodium', color: 'orange' },
    ],
    whyItWorks:
      'Shrimp delivers **exceptional protein density** at very low calories, making it ideal for lean muscle maintenance. Garlic\'s **allicin compound** has proven antibacterial and cardiovascular benefits. Honey provides **natural antimicrobial properties** and a more complex flavor than refined sugar.',
  },
  {
    id: '10',
    name: 'Red Lentil Soup',
    tag: 'Vegan',
    imageUrl: aiFood('bowl of red lentil soup with a swirl of cream and fresh herbs', 110, 530),
    height: 210,
    prepTime: '10 min',
    cookTime: '25 min',
    servings: 4,
    ingredients: [
      '2 cups red lentils, rinsed',
      '1 large onion, diced',
      '3 garlic cloves, minced',
      '2 carrots, diced',
      '1 tsp ground cumin',
      '1 tsp ground turmeric',
      '1.5L vegetable broth',
      'Lemon juice to taste',
    ],
    description:
      'A warming, golden-hued soup simmered with aromatic spices and hearty red lentils. This one-pot vegan comfort food is deeply nourishing and ready in under 35 minutes.',
    steps: [
      'Sauté onion in a drizzle of olive oil over medium heat until softened, about 5 minutes. Add garlic and cook 1 minute more.',
      'Add diced carrots, cumin, and turmeric. Cook, stirring, for 2 minutes until the spices are fragrant.',
      'Add the rinsed red lentils and pour in the vegetable broth. Bring to a boil.',
      'Reduce heat, cover, and simmer for 20 minutes until the lentils are completely soft and beginning to dissolve.',
      'Use an immersion blender to partially blend the soup for a creamy-chunky texture. Stir in lemon juice, season to taste, and serve.',
    ],
    calories: 290,
    carbsPercent: 58,
    fatsPercent: 12,
    proteinPercent: 30,
    healthTags: [
      { label: 'Heart Healthy', color: 'green' },
      { label: 'High Fiber', color: 'green' },
      { label: 'Anti-Inflammatory', color: 'green' },
      { label: 'Moderate Iron', color: 'orange' },
    ],
    whyItWorks:
      'Red lentils are packed with **folate and iron**, critical for red blood cell production. Turmeric\'s **curcumin** is one of the most studied natural anti-inflammatory compounds, enhanced by absorption when combined with black pepper. Lemon juice boosts **iron absorption** from the lentils.',
  },
  {
    id: '11',
    name: 'Yogurt Parfait',
    tag: 'High-Protein',
    imageUrl: aiFood('layered Greek yogurt parfait with fresh berries and granola in a glass jar', 111, 470),
    height: 185,
    prepTime: '5 min',
    cookTime: '0 min',
    servings: 1,
    ingredients: [
      '200g plain Greek yogurt',
      '1/3 cup granola',
      '1/2 cup mixed fresh berries',
      '1 tbsp honey',
      '1/2 tsp vanilla extract',
      'Fresh mint leaves',
    ],
    description:
      'A no-cook protein-packed parfait that doubles as breakfast or dessert. Creamy Greek yogurt layered with crunchy granola and fresh berries, lightly sweetened with honey and vanilla.',
    steps: [
      'Stir vanilla extract into the Greek yogurt until combined.',
      'Spoon half the yogurt into a glass jar or bowl.',
      'Add a layer of granola followed by half the berries.',
      'Top with the remaining yogurt and another layer of granola.',
      'Finish with the remaining berries, a drizzle of honey, and a sprig of fresh mint. Serve immediately or refrigerate for up to 2 hours.',
    ],
    calories: 320,
    carbsPercent: 45,
    fatsPercent: 18,
    proteinPercent: 37,
    healthTags: [
      { label: 'High-Protein', color: 'green' },
      { label: 'Probiotic-Rich', color: 'green' },
      { label: 'Low Glycemic', color: 'green' },
      { label: 'Moderate Sugar', color: 'orange' },
    ],
    whyItWorks:
      'Greek yogurt contains **twice the protein of regular yogurt** and live cultures that support digestive health. Berries add **polyphenols and vitamin C** that protect cells from oxidative stress. Granola\'s oats provide **beta-glucan fiber** that has been shown to lower LDL cholesterol.',
  },
  {
    id: '12',
    name: 'Pad Thai',
    tag: 'Gluten-Free',
    imageUrl: aiFood('pad thai noodles with shrimp, bean sprouts, peanuts and lime wedge', 112),
    height: 200,
    prepTime: '15 min',
    cookTime: '15 min',
    servings: 2,
    ingredients: [
      '200g flat rice noodles',
      '200g shrimp or firm tofu',
      '2 eggs',
      '3 tbsp fish sauce',
      '2 tbsp tamarind paste',
      '1 tbsp brown sugar',
      'Bean sprouts',
      'Crushed roasted peanuts',
      'Lime wedges to serve',
    ],
    description:
      'The iconic Thai street noodle dish made at home in 30 minutes. Chewy rice noodles tossed in a tangy tamarind sauce with shrimp, egg, and crunchy peanuts — a perfect balance of sweet, sour, and savory.',
    steps: [
      'Soak the rice noodles in warm water for 30 minutes until pliable, then drain.',
      'Whisk together fish sauce, tamarind paste, and brown sugar to make the pad thai sauce.',
      'Heat a wok over very high heat. Add oil and stir-fry shrimp or tofu until cooked, 2–3 minutes. Push to the side.',
      'Add the noodles and pour the sauce over them. Toss vigorously for 2 minutes.',
      'Push noodles to one side, crack in the eggs, and scramble. Fold everything together with bean sprouts. Plate and top with crushed peanuts and lime wedges.',
    ],
    calories: 480,
    carbsPercent: 52,
    fatsPercent: 22,
    proteinPercent: 26,
    healthTags: [
      { label: 'Gluten-Free', color: 'green' },
      { label: 'High-Protein', color: 'green' },
      { label: 'Moderate Sodium', color: 'orange' },
      { label: 'High Potassium', color: 'orange' },
    ],
    whyItWorks:
      'Rice noodles are **naturally gluten-free** and easier to digest than wheat pasta. Tamarind is rich in **tartaric acid**, which acts as a natural antioxidant and digestive aid. Peanuts add **resveratrol and niacin**, supporting cardiovascular health and energy metabolism.',
  },
  {
    id: '13',
    name: 'Veggie Stir-Fry',
    tag: 'Vegan',
    imageUrl: aiFood('colorful vegetable stir-fry in a wok with bell peppers and broccoli', 113, 440),
    height: 175,
    prepTime: '15 min',
    cookTime: '10 min',
    servings: 2,
    ingredients: [
      '2 cups broccoli florets',
      '1 red bell pepper, sliced',
      '1 yellow bell pepper, sliced',
      '1 cup snap peas',
      '3 garlic cloves, minced',
      '2 tbsp soy sauce',
      '1 tbsp oyster sauce',
      '1 tsp sesame oil',
      'Steamed rice to serve',
    ],
    description:
      'A rainbow wok toss of crisp vegetables in a savory garlic sauce that comes together in 10 minutes. Vibrant, crunchy, and packed with vitamins — this is weeknight vegan cooking at its easiest.',
    steps: [
      'Prep all vegetables and make the sauce by combining soy sauce, oyster sauce, and sesame oil.',
      'Heat a wok or large skillet over high heat until smoking. Add a thin layer of neutral oil.',
      'Add broccoli florets and stir-fry for 2 minutes until bright green but still crisp.',
      'Add bell peppers, snap peas, and garlic. Stir-fry for another 3 minutes, keeping everything moving.',
      'Pour the sauce over the vegetables and toss for 1 minute until everything is coated and fragrant. Serve over steamed rice.',
    ],
    calories: 240,
    carbsPercent: 48,
    fatsPercent: 18,
    proteinPercent: 34,
    healthTags: [
      { label: 'Low Calorie', color: 'green' },
      { label: 'Vegan', color: 'green' },
      { label: 'Vitamin C Rich', color: 'green' },
      { label: 'Moderate Sodium', color: 'orange' },
    ],
    whyItWorks:
      'Bell peppers contain **3x more vitamin C than oranges** by weight, supporting collagen production and immune function. Broccoli provides **sulforaphane**, a compound that activates the body\'s own antioxidant defense system. Snap peas add **prebiotic fiber** for gut microbiome diversity.',
  },
  {
    id: '14',
    name: 'Beef Bulgogi',
    tag: 'High-Protein',
    imageUrl: aiFood('Korean beef bulgogi with marinated meat, sesame oil and spring onions', 114, 520),
    height: 205,
    prepTime: '30 min',
    cookTime: '10 min',
    servings: 3,
    ingredients: [
      '500g beef sirloin, thinly sliced',
      '4 tbsp soy sauce',
      '2 tbsp sesame oil',
      '2 tbsp brown sugar',
      '5 garlic cloves, minced',
      '1 tsp fresh ginger, grated',
      '2 spring onions, sliced',
      'Sesame seeds',
      'Steamed rice to serve',
    ],
    description:
      'Korea\'s beloved grilled beef dish — paper-thin sirloin marinated in a sweet-savory blend of soy, sesame, and garlic. The high-heat sear creates irresistible caramelized edges with tender, juicy centers.',
    steps: [
      'Whisk together soy sauce, sesame oil, brown sugar, garlic, ginger, and half the spring onions in a bowl.',
      'Add the thinly sliced beef to the marinade, toss well, and refrigerate for at least 20 minutes (up to overnight).',
      'Heat a grill pan or cast iron skillet over very high heat until almost smoking.',
      'Cook the beef in a single layer for 1–2 minutes per side until caramelized. Do not crowd the pan — cook in batches.',
      'Transfer to a plate, garnish with remaining spring onions and sesame seeds. Serve immediately over steamed rice.',
    ],
    calories: 480,
    carbsPercent: 18,
    fatsPercent: 38,
    proteinPercent: 44,
    healthTags: [
      { label: 'High-Protein', color: 'green' },
      { label: 'High Iron', color: 'green' },
      { label: 'Zinc-Rich', color: 'green' },
      { label: 'Moderate Sodium', color: 'orange' },
    ],
    whyItWorks:
      'Beef sirloin provides **heme iron**, the most bioavailable form of iron, critical for oxygen transport. Sesame oil delivers **sesamol and sesamin**, lignans that protect the liver and lower blood pressure. Ginger adds **gingerols** that reduce muscle soreness and improve digestion.',
  },
];
