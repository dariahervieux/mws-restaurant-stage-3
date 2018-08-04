import registerServiceWorker from './common.js';
import RetaurantsService from './restaurants_service.js';
import AddReviewModalHandler from './modal_review.js';

/**RetaurantsService instance  */
let retaurantsService;
/**Modal dialog handler instance  */
let addReviewModalHandler;

/**
 * Register SW for current page
 */
registerServiceWorker();

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  if (typeof google === "undefined") {
    console.warn('google is not defined!');
    return;
  }
  if (typeof self.restaurant === "undefined") return;
  if (self.map) {
    console.log("Map is already initialized");
  }

  const restaurant = self.restaurant;
  
  self.map = new google.maps.Map(document.getElementById('map'), {
    zoom: 16,
    center: restaurant.latlng,
    scrollwheel: false
  });
  // Set title on map iframe once map has loaded
  self.map.addListener('tilesloaded', () => {
    const mapFrame = document.querySelector('#map iframe');
    mapFrame.setAttribute('title', `Google map with ${restaurant.name} restaurant location`);
  });
  RetaurantsService.mapMarkerForRestaurant(restaurant, self.map);
}


window.addEventListener('load', () => {
  retaurantsService = new RetaurantsService();
  retaurantsService.initData()
    .then(() => {
      fetchRestaurantFromURL()
        .then( restaurant => {
          self.restaurant = restaurant;
          if (!restaurant) {
            console.error('No restaurant found');
            return;
          }
          fillRestaurantHTML();
          fillBreadcrumb();
          addReviewModalHandler = new AddReviewModalHandler();
          window.initMap();
        })
        .catch(error => console.error(error));
    });
});

/**
 * Get current restaurant from page URL.
 */
let fetchRestaurantFromURL = () => {
  if (self.restaurant) { // restaurant already fetched!
    return self.restaurant;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    throw Error('No restaurant id in URL');
  } else {
    return retaurantsService.getResaurantById(id);
  }
}

/**
 * Create restaurant HTML and add it to the webpage
 */
let fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

  const isFavorite = document.getElementById('restaurant-is-favorite');

  const changeFavoriteButtonAttributes = () => {
    isFavorite.className = restaurant.is_favorite ? 'favorite' : 'make_favorite';
    const title = restaurant.is_favorite ? 'Remove from favorite' : 'Add to favorite';
    isFavorite.setAttribute('title', title);
  };

  changeFavoriteButtonAttributes();

  isFavorite.onclick =  () => {
    retaurantsService.toggleFavorite(restaurant.id, !restaurant.is_favorite)
      // if toggle succeeds, favorite value has changed
      .then((result) => {
        console.debug(`Toggle result=${result}`);
        restaurant.is_favorite = !restaurant.is_favorite;
        changeFavoriteButtonAttributes();
      });
  }

  const addReviewButton =  document.getElementById('add-button');
  if (addReviewButton) {
    addReviewButton.onclick = ()=> { 
      addReviewModalHandler.open()
        .then(reviewFormData => { 
          if(reviewFormData) {
            retaurantsService.addReview(restaurant.id, reviewFormData).then( () =>
              addReviewHTMl(reviewFormData)
            );            
          }
        });
    }
  }

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const image = document.getElementById('restaurant-img');

  const defaultRestImageUrl = RetaurantsService.imageUrlForRestaurant(restaurant);
  if (defaultRestImageUrl) {
    const imageUrlWithoutExtention = defaultRestImageUrl.replace(/\.[^/.]+$/, "");
    image.src = `${imageUrlWithoutExtention}_550.webp`;
    image.srcset = `${imageUrlWithoutExtention}_800.webp 800w, ${imageUrlWithoutExtention}_550.webp 550w, ${imageUrlWithoutExtention}_250.webp 250w`;
  } else {
    image.className = 'restaurant-img-none';
  }
  image.alt = `${restaurant.name} restaurant`;

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  fillReviewsHTML();
}


/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
let fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
let fillReviewsHTML = (reviews = self.restaurant.reviews) => {
  const container = document.getElementById('reviews-container');
 
  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
}

let addReviewHTMl = (review) => {
  const ul = document.getElementById('reviews-list');
  ul.appendChild(createReviewHTML(review));
}

/**
 * Create review HTML and add it to the webpage.
 */
let createReviewHTML = (review) => {
  const li = document.createElement('li');
  const name = document.createElement('p');
  name.innerHTML = review.name;
  li.appendChild(name);

  const date = document.createElement('p');
  date.innerHTML = new Date(review.createdAt).toLocaleDateString("en-US");
  li.appendChild(date);

  const rating = document.createElement('p');
  let i = review.rating;
  let ratingStars = (i == 0) ? 'Not rated' : '';
  while (i-- > 0) {
    ratingStars += '★';
  }
  rating.innerHTML = `Rating: <span class="stars">${ratingStars}</span>`;
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
let fillBreadcrumb = (restaurant = self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.innerHTML = restaurant.name;
  li.setAttribute('aria-current', 'page'); /*optional*/
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
let getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
